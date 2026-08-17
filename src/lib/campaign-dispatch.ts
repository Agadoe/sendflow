/**
 * Shared campaign dispatch logic — the single source of truth for how a
 * campaign's pending messages are sent.
 *
 * Used by BOTH:
 *  - src/app/api/campaigns/send/route.ts  (the Vercel dashboard "Send" path,
 *    cookie/X-Cron-Secret auth + HTTP wrapper)
 *  - scripts/local-scheduler.ts           (the macOS-local long-running
 *    scheduler that fires SCHEDULED campaigns without any VPS or Vercel cron)
 *
 * Keeping the paced-send loop here (not duplicated in each caller) is what
 * prevents the anti-ban safeguards from drifting between the two paths. The
 * cadence and guards are ban-critical: any divergence risks WhatsApp bans.
 *
 * Sends one message at a time with randomized human-like delays, in-memory
 * rate caps, business-hours gating, opt-in + 7-day-duplicate skips, and
 * message-text spin variation. No concurrent/batched sends.
 */

import { prisma } from '@/lib/prisma';
import { fetchDaemon, formatPhone } from '@/lib/daemon-fetch';
import { getSmsProvider, type SmsProvider } from '@/lib/sms';

// ─── Pure helpers (unit-tested in campaign-dispatch.test.ts) ────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Human-like delay before sending the (index+1)-th message of a batch.
 * - Most messages: 4–12 s
 * - Every 5th: 15–35 s
 * - Every 10th: 30–60 s
 * Randomized so the cadence never looks mechanical.
 */
export function getHumanDelay(index: number): number {
  // Conservative anti-ban pacing (revised 2026-08-17 after WhatsApp forced a
  // LOGOUT on the prior 4-12s pacing — that's the "spam bot" signature per
  // current best practice, which recommends 30-90s+ randomized). Base 45-120s,
  // longer every 5th and 10th for human-like irregularity. With a 20/session
  // cap this yields ~30-40 min per session.
  if (index > 0 && index % 10 === 0) return 180000 + Math.floor(Math.random() * 180000);
  if (index > 0 && index % 5 === 0) return 90000 + Math.floor(Math.random() * 90000);
  return 45000 + Math.floor(Math.random() * 75000);
}

/** 08:00–20:00 in the user's timezone. On any parse error, allow (don't block). */
export function isBusinessHours(timezone: string, now: Date = new Date()): boolean {
  try {
    const s = now.toLocaleString('en-US', { timeZone: timezone, hour12: false });
    const hour = parseInt(s.split(',')[1].trim().split(':')[0], 10);
    return hour >= 8 && hour < 20;
  } catch {
    return true;
  }
}

/** Replace {{name}} and spin greeting phrasing so bulk sends vary. */
export function personalize(content: string, name?: string | null): string {
  let msg = content.replace(/\{\{name\}\}/gi, name || 'there');
  const spins = [
    { pattern: /Hi,/gi, variants: ['Hi,', 'Hey,', 'Hello,'] },
    { pattern: /hope you/gi, variants: ['hope you', 'hope that you'] },
    { pattern: /have a lovely/gi, variants: ['have a lovely', 'have a great', 'have a wonderful'] },
    { pattern: /have a good/gi, variants: ['have a good', 'have a nice'] },
  ];
  for (const spin of spins) {
    if (spin.pattern.test(msg)) {
      const variant = spin.variants[Math.floor(Math.random() * spin.variants.length)];
      msg = msg.replace(spin.pattern, variant);
    }
  }
  return msg;
}

/** Same exact content to the same contact within 7 days → duplicate. */
export function isDuplicate(
  contact: { lastMessageContent?: string | null; lastMessageSentAt?: Date | string | null },
  content: string,
): boolean {
  if (!contact.lastMessageContent || !contact.lastMessageSentAt) return false;
  const daysSince = (Date.now() - new Date(contact.lastMessageSentAt).getTime()) / 86_400_000;
  return contact.lastMessageContent === content && daysSince < 7;
}

// ─── In-memory rate limiter (per process) ───────────────────────────────────
// Resets on cold start. Adequate for a single long-running scheduler process
// and for a single serverless invocation; not shared across instances.

export const MAX_PER_MINUTE = 20;
export const MAX_PER_DAY = 300;

export interface RateLimitResult {
  ok: boolean;
  retryAfter?: number;
  reason?: string;
}

export function createRateLimiter() {
  const rateMap = new Map<string, any>();

  function check(userId: string): RateLimitResult {
    const now = Date.now();
    const entry = rateMap.get(userId) || { count: 0, minuteReset: now + 60_000, dayReset: now + 86_400_000 };

    if (now > entry.minuteReset) {
      entry.count = 0;
      entry.minuteReset = now + 60_000;
    }
    if (now > entry.dayReset) {
      entry.count = 0;
      entry.dayReset = now + 86_400_000;
    }

    if (entry.count >= MAX_PER_DAY) {
      const seconds = Math.ceil((entry.dayReset - now) / 1000);
      return { ok: false, retryAfter: seconds, reason: `Daily limit of ${MAX_PER_DAY} messages reached.` };
    }

    const minuteKey = `${userId}:${Math.floor(now / 60_000)}`;
    const minuteEntry = rateMap.get(minuteKey) || { count: 0, resetAt: now + 60_000 };
    if (now > minuteEntry.resetAt) {
      minuteEntry.count = 0;
      minuteEntry.resetAt = now + 60_000;
    }
    if (minuteEntry.count >= MAX_PER_MINUTE) {
      const seconds = Math.ceil((minuteEntry.resetAt - now) / 1000);
      return { ok: false, retryAfter: seconds, reason: `Rate limit: max ${MAX_PER_MINUTE} messages/minute.` };
    }

    minuteEntry.count++;
    rateMap.set(minuteKey, minuteEntry);
    entry.count++;
    rateMap.set(userId, entry);
    return { ok: true };
  }

  return { check };
}

// ─── Send via the wacli daemon ──────────────────────────────────────────────

/**
 * POSTs one message to the daemon's /wacli/send. The daemon URL is resolved
 * by fetchDaemon from WACLI_DAEMON_URL (the Vercel route uses the ngrok URL;
 * the local scheduler sets WACLI_DAEMON_URL=http://localhost:4555).
 */
export async function sendViaDaemon(userId: string, phone: string, message: string): Promise<void> {
  const res = await fetchDaemon('/wacli/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    // Daemon handler destructures { phone, message } (wacli-daemon.js:570) and
    // returns 400 'phone and message required' if phone is missing. The daemon
    // runs formatPhone() itself, so sending the +233-normalized number is safe
    // (idempotent). NOTE: an earlier note claimed the daemon wanted { to, ... }
    // — that was inverted; the live send on 2026-08-17 proved it wants `phone`.
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || err.message || `Daemon returned ${res.status}`);
  }
}

// ─── Send via the SMS provider (Sendexa et al.) ─────────────────────────────
/**
 * Sends one SMS through the configured SMS provider (src/lib/sms). Throws on
 * failure so dispatchCampaign's catch block marks the Message FAILED with the
 * reason — mirroring sendViaDaemon's throw-on-!res.ok contract. `provider` is
 * injectable for tests; production uses the env-configured gateway.
 *
 * SMS is a paid carrier channel with no account-ban risk, so the WhatsApp
 * anti-ban cadence, business-hours gate, and 20/min+300/day caps do NOT apply
 * to this path — dispatchCampaign gates those on `!isSms`.
 */
export async function sendViaSms(phone: string, message: string, provider: SmsProvider = getSmsProvider()): Promise<void> {
  const result = await provider.send({ to: phone, message });
  if (!result.success) {
    throw new Error(result.reason || 'SMS send failed');
  }
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

export interface DispatchOptions {
  campaignId: string;
  userId: string;
  /** Max messages per invocation. Default 5. The scheduler loops until done. */
  batchSize?: number;
  /** If true: log what would be sent, mutate NOTHING, send nothing. */
  dryRun?: boolean;
  /** Progress callback for the scheduler's logs. */
  onProgress?: (info: {
    index: number;
    total: number;
    delayMs: number;
    phone: string;
    status: 'SENT' | 'SKIPPED' | 'FAILED' | 'WOULD_SEND';
    reason?: string;
    preview: string;
  }) => void;
  /** Abort signal — checked between messages for graceful shutdown. */
  signal?: AbortSignal;
}

export interface DispatchResult {
  sent: number;
  wouldSend: number;
  failed: number;
  skipped: number;
  remaining: number;
  total: number;
  done: boolean;
  rateLimited?: boolean;
  outsideBusinessHours?: boolean;
  error?: string;
}

const defaultLimiter = createRateLimiter();

/**
 * Resolve a campaign's recipients (segment-resolved + snapshot), then send its
 * PENDING messages one at a time with human pacing. Idempotent across
 * invocations: only PENDING messages are processed, so re-entry resumes safely.
 *
 * Returns a summary. If `dryRun`, no DB writes and no daemon calls — purely a
 * preview of the cadence and recipient set.
 */
export async function dispatchCampaign(opts: DispatchOptions, limiter = defaultLimiter): Promise<DispatchResult> {
  const { campaignId, userId, dryRun = false, onProgress, signal } = opts;
  // Caller chooses the batch size. The Vercel route caps at 5 (serverless
  // timeout); the local scheduler passes a large value so a whole campaign
  // runs in one continuous paced loop and the every-5th/10th longer pauses
  // in getHumanDelay actually fire (in a batch-of-5 they never would).
  const batchSize = opts.batchSize ?? 5;

  const empty = (over: Partial<DispatchResult> = {}): DispatchResult => ({
    sent: 0, wouldSend: 0, failed: 0, skipped: 0, remaining: 0, total: 0, done: false, ...over,
  });

  // Load the user for timezone (business-hours gate).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true },
  });
  if (!user) return empty({ error: 'User not found' });

  // ── Resolve segmentIds → contact IDs at send time ──
  const preCampaign = await prisma.campaign.findUnique({
    where: { id: campaignId, userId: user.id },
    select: { id: true, status: true, content: true, channel: true, segmentIds: true, _count: { select: { messages: true } } },
  });
  if (!preCampaign) return empty({ error: 'Campaign not found' });

  // WhatsApp-only safeguards. SMS is a paid carrier channel with no account-ban
  // risk, so the business-hours gate and the 20/min+300/day caps apply only to
  // the WhatsApp path; SMS sends as fast as the provider allows (a small
  // inter-message delay keeps progress legible and the abort signal responsive).
  const isSms = preCampaign.channel === 'sms';
  if (!isSms && !isBusinessHours(user.timezone || 'UTC')) {
    return empty({ outsideBusinessHours: true, error: 'Outside business hours (08:00–20:00 user timezone)' });
  }

  // Rate caps govern REAL WhatsApp send volume. In a dry-run we preview without
  // sending, so the caps don't apply (otherwise a 208-contact preview would
  // stop after 20 and never show the full recipient set). SMS bypasses the caps.
  if (!isSms && !dryRun) {
    const rateCheck = limiter.check(user.id);
    if (!rateCheck.ok) {
      return empty({ rateLimited: true, error: rateCheck.reason });
    }
  }

  let resolvedSegmentContactIds: Set<string> = new Set();
  if (preCampaign.segmentIds) {
    let segIds: string[] = [];
    try { segIds = JSON.parse(preCampaign.segmentIds); } catch {}
    if (segIds.length > 0) {
      const segs = await prisma.segment.findMany({
        where: { id: { in: segIds }, userId: user.id },
        select: { tag: true },
      });
      // Segment.tag is a bare string (e.g. "phones-segment"), matched against
      // each contact's tags JSON array.
      const tags = new Set(segs.map((s) => s.tag));
      const allContacts = await prisma.contact.findMany({
        where: { userId: user.id },
        select: { id: true, tags: true },
      });
      for (const c of allContacts) {
        try {
          const ct: string[] = JSON.parse(c.tags || '[]');
          if (ct.some((t) => tags.has(t))) resolvedSegmentContactIds.add(c.id);
        } catch {}
      }
    }
  }

  const hasExistingMessages = preCampaign._count.messages > 0;

  // Live run: materialize Message rows for segment-resolved contacts. Snapshot
  // campaigns create them once; segment re-runs add any newly-tagged contacts.
  if (!dryRun && resolvedSegmentContactIds.size > 0) {
    if (!hasExistingMessages) {
      await prisma.message.createMany({
        data: Array.from(resolvedSegmentContactIds).map((contactId) => ({
          campaignId: preCampaign.id,
          contactId,
          status: 'PENDING',
        })),
      });
    } else {
      const existingMessages = await prisma.message.findMany({
        where: { campaignId: preCampaign.id },
        select: { contactId: true },
      });
      const existingContactIds = new Set(existingMessages.map((m) => m.contactId));
      const newRows: { campaignId: string; contactId: string; status: 'PENDING' }[] = [];
      resolvedSegmentContactIds.forEach((cid) => {
        if (!existingContactIds.has(cid)) {
          newRows.push({ campaignId: preCampaign.id, contactId: cid, status: 'PENDING' });
        }
      });
      if (newRows.length > 0) {
        await prisma.message.createMany({ data: newRows });
      }
    }
  }

  // ── Build the recipient list ──
  // A recipient pairs an optional Message row id with its contact. messageId
  // is null only in a dry-run of a segment-based campaign with no snapshot —
  // we preview the resolved contacts read-only without creating Message rows.
  type Recipient = { messageId: string | null; contact: any };
  let recipients: Recipient[] = [];
  let total: number;

  if (hasExistingMessages || (!dryRun && resolvedSegmentContactIds.size > 0)) {
    // Snapshot messages (or just-created segment messages) — load PENDING rows.
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId, userId: user.id },
      include: {
        messages: {
          include: { contact: true },
          where: { status: 'PENDING' },
          take: batchSize,
        },
      },
    });
    if (!campaign) return empty({ error: 'Campaign not found' });
    recipients = campaign.messages.map((m) => ({ messageId: m.id, contact: m.contact }));
    total = await prisma.message.count({ where: { campaignId } });

    // Mark SENDING on the first real (non-dry-run) batch.
    if (!dryRun && (campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED')) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'SENDING', sentAt: new Date() },
      });
    }
  } else if (dryRun && resolvedSegmentContactIds.size > 0) {
    // Dry-run of a segment-based campaign with no snapshot — preview the
    // resolved contacts read-only (no Message rows, no writes, no sends).
    const contacts = await prisma.contact.findMany({
      where: { id: { in: Array.from(resolvedSegmentContactIds) } },
      select: { id: true, phone: true, name: true, optedIn: true, lastMessageContent: true, lastMessageSentAt: true },
    });
    recipients = contacts.map((c) => ({ messageId: null, contact: c }));
    total = recipients.length;
  } else {
    // No snapshot messages AND no segment — genuinely nothing to send.
    return empty({ error: 'No contacts to send to. Select at least one segment or contact.' });
  }

  if (recipients.length === 0) {
    // Messages exist but none PENDING (already fully sent), or segment resolved
    // to zero contacts. Nothing to do.
    return { sent: 0, wouldSend: 0, failed: 0, skipped: 0, remaining: 0, total, done: true };
  }

  let sent = 0, wouldSend = 0, failed = 0, skipped = 0;
  // Append an opt-out line so recipients have a civilized alternative to
  // blocking/reporting — report rate is Meta's #1 ban signal. Appended here
  // (not stored on the campaign) so it applies to every outbound send and so
  // dedup (which compares against this same baseContent) stays consistent.
  const OPT_OUT = '\n\nReply STOP to unsubscribe.';
  const baseContent = (preCampaign.content || '').trimEnd() + OPT_OUT;
  const preview = (s: string) => s.replace(/\s+/g, ' ').slice(0, 60);

  for (let i = 0; i < recipients.length; i++) {
    if (signal?.aborted) break;

    const contact = recipients[i].contact;
    const messageId = recipients[i].messageId;

    if (!contact.optedIn) {
      if (!dryRun && messageId) {
        await prisma.message.update({
          where: { id: messageId },
          data: { status: 'SKIPPED', failureReason: `Contact has not opted in to ${isSms ? 'SMS' : 'WhatsApp'} messages` },
        });
      }
      skipped++;
      onProgress?.({ index: i, total, delayMs: 0, phone: contact.phone, status: 'SKIPPED', reason: 'not opted in', preview: preview(baseContent) });
      continue;
    }

    if (isDuplicate(contact, baseContent)) {
      if (!dryRun && messageId) {
        await prisma.message.update({
          where: { id: messageId },
          data: { status: 'SKIPPED', failureReason: 'Duplicate message sent within 7 days' },
        });
      }
      skipped++;
      onProgress?.({ index: i, total, delayMs: 0, phone: contact.phone, status: 'SKIPPED', reason: 'duplicate within 7d', preview: preview(baseContent) });
      continue;
    }

    const personalized = personalize(baseContent, contact.name);
    // WhatsApp uses the anti-ban cadence (45-120s+). SMS is a paid carrier
    // channel with no ban risk, so it only waits a small inter-message delay
    // (200-500ms) to keep progress legible and the abort signal responsive.
    const delay = isSms ? 200 + Math.floor(Math.random() * 300) : getHumanDelay(i);
    // In dry-run, don't actually wait — the delay is still reported via
    // onProgress so the cadence is visible. Real sends sleep the full delay.
    if (!dryRun) await sleep(delay);

    // Mid-loop rate check (a long WhatsApp batch can cross a minute boundary).
    // Skipped in dry-run and for SMS — SMS has no volume caps.
    if (!isSms && !dryRun) {
      const midCheck = limiter.check(user.id);
      if (!midCheck.ok) {
        await prisma.message.updateMany({
          where: { campaignId, status: 'PENDING' },
          data: { failureReason: `Rate limited: ${midCheck.reason}` },
        });
        onProgress?.({ index: i, total, delayMs: delay, phone: contact.phone, status: 'FAILED', reason: `rate limited: ${midCheck.reason}`, preview: preview(personalized) });
        return {
          sent, wouldSend, failed, skipped,
          remaining: await prisma.message.count({ where: { campaignId, status: 'PENDING' } }),
          total, done: false, rateLimited: true, error: midCheck.reason,
        };
      }
    }

    if (dryRun) {
      wouldSend++;
      onProgress?.({ index: i, total, delayMs: delay, phone: contact.phone, status: 'WOULD_SEND', preview: preview(personalized) });
      continue;
    }

    try {
      const formatted = formatPhone(contact.phone);
      if (isSms) {
        await sendViaSms(formatted, personalized);
      } else {
        await sendViaDaemon(user.id, formatted, personalized);
      }
      if (messageId) {
        await prisma.message.update({
          where: { id: messageId },
          data: { status: 'SENT', sentAt: new Date() },
        });
      }
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastMessageContent: personalized, lastMessageSentAt: new Date() },
      });
      sent++;
      onProgress?.({ index: i, total, delayMs: delay, phone: contact.phone, status: 'SENT', preview: preview(personalized) });
    } catch (e: any) {
      if (messageId) {
        await prisma.message.update({
          where: { id: messageId },
          data: { status: 'FAILED', failureReason: e.message },
        });
      }
      failed++;
      onProgress?.({ index: i, total, delayMs: delay, phone: contact.phone, status: 'FAILED', reason: e.message, preview: preview(personalized) });
    }
  }

  // Dry-run previews the whole recipient set in one call → nothing remains.
  // Live: count actual PENDING rows left (may resume on a later invocation).
  const remainingPending = dryRun ? 0 : await prisma.message.count({ where: { campaignId, status: 'PENDING' } });

  // Final status only when nothing remains (non-dry-run).
  if (!dryRun && remainingPending === 0) {
    const sentCount = await prisma.message.count({ where: { campaignId, status: 'SENT' } });
    const finalStatus = sentCount > 0 ? 'SENT' : 'FAILED';
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus },
    });
  }

  return {
    sent, wouldSend, failed, skipped,
    remaining: remainingPending, total, done: remainingPending === 0,
  };
}