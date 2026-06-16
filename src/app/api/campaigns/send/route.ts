import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131';

// ─── In-Memory Rate Limit (resets on cold start; use Redis in production) ───
const rateMap = new Map<string, { count: number; minuteReset: number; dayReset: number }>();
const MAX_PER_MINUTE = 30;
const MAX_PER_DAY = 500;

function checkRateLimit(userId: string): { ok: boolean; retryAfter?: number; reason?: string } {
  const now = Date.now();
  const entry = rateMap.get(userId) || { count: 0, minuteReset: now + 60_000, dayReset: now + 86_400_000 };

  // Reset windows
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

  // Per-minute bucket is stricter for burst protection
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

  // Increment both
  minuteEntry.count++;
  rateMap.set(minuteKey, minuteEntry);
  entry.count++;
  rateMap.set(userId, entry);
  return { ok: true };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

function isBusinessHours(timezone: string): boolean {
  try {
    const now = new Date().toLocaleString('en-US', { timeZone: timezone, hour12: false });
    const hour = parseInt(now.split(',')[1].trim().split(':')[0], 10);
    return hour >= 8 && hour < 20; // 8am – 8pm
  } catch {
    return true; // fallback: allow if timezone invalid
  }
}

function personalize(content: string, name?: string | null): string {
  let msg = content.replace(/\{\{name\}\}/gi, name || 'there');
  // Light spin-text: replace common patterns with slight variations
  const spins = [
    { pattern: /Hi,/gi, variants: ['Hi,', 'Hey,', 'Hello,'] },
    { pattern: /hope you/gi, variants: ['hope you', 'hope that you'] },
    { pattern: /have a lovely/gi, variants: ['have a lovely', 'have a great', 'have a wonderful'] },
  ];
  for (const spin of spins) {
    if (spin.pattern.test(msg)) {
      const variant = spin.variants[Math.floor(Math.random() * spin.variants.length)];
      msg = msg.replace(spin.pattern, variant);
    }
  }
  return msg;
}

function isDuplicate(contact: any, content: string): boolean {
  if (!contact.lastMessageContent || !contact.lastMessageSentAt) return false;
  const daysSince = (Date.now() - new Date(contact.lastMessageSentAt).getTime()) / 86_400_000;
  return contact.lastMessageContent === content && daysSince < 7;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendViaDaemon(userId: string, phone: string, message: string): Promise<void> {
  const res = await fetch(`${DAEMON_URL}/wacli/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Daemon returned ${res.status}`);
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { campaignId } = await req.json();
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
  }

  // Hour guard
  if (!isBusinessHours(user.timezone || 'UTC')) {
    return NextResponse.json(
      { error: 'Messages can only be sent between 8:00 AM and 8:00 PM in your timezone.' },
      { status: 403 }
    );
  }

  // Rate limit
  const rateCheck = checkRateLimit(user.id);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: rateCheck.reason, retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId, userId: user.id },
    include: {
      messages: {
        include: { contact: true },
        where: { status: 'PENDING' },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', sentAt: new Date() },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const results: { contactId: string; status: string; reason?: string }[] = [];

  for (const msg of campaign.messages) {
    const contact = msg.contact;
    const baseContent = campaign.content;

    // 1. Opt-in guard
    if (!contact.optedIn) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SKIPPED', failureReason: 'Contact has not opted in to WhatsApp messages' },
      });
      skipped++;
      results.push({ contactId: contact.id, status: 'SKIPPED', reason: 'Not opted in' });
      continue;
    }

    // 2. Duplicate guard (same content within 7 days)
    if (isDuplicate(contact, baseContent)) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SKIPPED', failureReason: 'Duplicate message sent within 7 days' },
      });
      skipped++;
      results.push({ contactId: contact.id, status: 'SKIPPED', reason: 'Duplicate within 7 days' });
      continue;
    }

    // 3. Personalize & vary
    const personalized = personalize(baseContent, contact.name);

    // 4. Jitter delay (5–30s) between sends to avoid robotic cadence
    const jitter = 5000 + Math.floor(Math.random() * 25_000);
    await sleep(jitter);

    // 5. Re-check rate limit mid-loop (bursts can happen)
    const midCheck = checkRateLimit(user.id);
    if (!midCheck.ok) {
      // Mark remaining as PENDING so user can retry later
      await prisma.message.updateMany({
        where: { campaignId, status: 'PENDING' },
        data: { status: 'PENDING', failureReason: `Rate limited: ${midCheck.reason}` },
      });
      break;
    }

    try {
      const formatted = formatPhone(contact.phone);
      await sendViaDaemon(user.id, formatted, personalized);
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastMessageContent: personalized, lastMessageSentAt: new Date() },
      });
      sent++;
      results.push({ contactId: contact.id, status: 'SENT' });
    } catch (e: any) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'FAILED', failureReason: e.message },
      });
      failed++;
      results.push({ contactId: contact.id, status: 'FAILED', reason: e.message });
    }
  }

  // Mark remaining PENDING as FAILED if loop ended early (e.g. rate limit)
  const remainingPending = await prisma.message.count({
    where: { campaignId, status: 'PENDING' },
  });
  if (remainingPending > 0) {
    await prisma.message.updateMany({
      where: { campaignId, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: 'Campaign ended before send (rate limit or error)' },
    });
    failed += remainingPending;
  }

  const finalStatus = sent > 0 ? 'SENT' : failed > 0 ? 'FAILED' : 'DRAFT';
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: finalStatus },
  });

  return NextResponse.json({
    sent,
    failed,
    skipped,
    total: campaign.messages.length,
    results,
  });
}
