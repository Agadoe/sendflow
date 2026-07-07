import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CRON_SECRET prevents unauthorized calls — set in .env
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, any> = {};
  const now = new Date();

  // ── 1. Drip scheduled messages due to send ──────────────────────────────
  const dueMessages = await prisma.dripScheduledMessage.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: now },
    },
    take: 50, // process in batches
    include: { user: true, contact: true },
  });

  results.drip = { found: dueMessages.length, sent: 0, failed: 0 };

  for (const msg of dueMessages) {
    let status = 'FAILED';
    let failureReason = '';
    try {
      if (msg.channel === 'whatsapp') {
        await sendWhatsApp(msg.userId, msg.contact.phone, msg.template);
      } else if (msg.channel === 'email') {
        await sendEmail(msg.userId, msg.contact.phone, msg.template);
      } else if (msg.channel === 'sms') {
        await sendSms(msg.userId, msg.contact.phone, msg.template);
      }
      status = 'SENT';
      results.drip.sent++;
    } catch (err: any) {
      failureReason = err.message;
      results.drip.failed++;
    }
    await prisma.dripScheduledMessage.update({
      where: { id: msg.id },
      data: { status, sentAt: status === 'SENT' ? new Date() : null, failureReason: failureReason || null },
    });
  }

  // ── 2. Recurring campaigns due today ─────────────────────────────────────
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const recurringCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      recurrence: { not: null },
      scheduledAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: { messages: true },
    take: 10, // safety: max 10 recurring campaigns per cron tick
  });

  results.recurring = { found: recurringCampaigns.length, sent: 0, errors: [] as string[] };

  for (const campaign of recurringCampaigns) {
    try {
      // Delegate to the canonical send route — same path the UI uses.
      // Loops internally until done (same as dashboard UI), respecting
      // business hours, rate limits, opt-in, dedup, human delays.
      const result = await runCampaignSend(campaign.id, campaign.userId, 9 * 60_000);
      results.recurring.sent += result.sent;
    } catch (err: any) {
      results.recurring.errors.push(`${campaign.id}: ${err.message}`);
    }

    // Advance to next recurrence regardless of send outcome
    const nextDate = getNextRecurrence(campaign.scheduledAt!, campaign.recurrence!);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { scheduledAt: nextDate },
    });
  }

  // ── 3. Scheduled (one-time) campaigns due now ────────────────────────────
  const dueCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      recurrence: null,
      scheduledAt: { lte: now },
    },
    include: { messages: true },
    take: 10, // safety: max 10 one-time campaigns per cron tick
    orderBy: { scheduledAt: 'asc' }, // oldest first
  });

  results.campaigns = { found: dueCampaigns.length, sent: 0, failed: 0, errors: [] as string[] };

  for (const campaign of dueCampaigns) {
    // Idempotency guard: another cron tick may already be running this one.
    // If status flipped to SENDING between the findMany and now, skip.
    const fresh = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      select: { status: true },
    });
    if (fresh?.status === 'SENDING') continue;

    try {
      const result = await runCampaignSend(campaign.id, campaign.userId, 9 * 60_000);
      results.campaigns.sent += result.sent;
      results.campaigns.failed += result.failed;
    } catch (err: any) {
      results.campaigns.failed++;
      results.campaigns.errors.push(`${campaign.id}: ${err.message}`);
    }
  }

  // ── 4. Trigger automations on contacts added today ───────────────────────
  const todayAdded = await prisma.contact.findMany({
    where: {
      createdAt: { gte: todayStart, lte: todayEnd },
    },
  });

  results.newContacts = todayAdded.length;
  results.automationsTriggered = 0;

  for (const contact of todayAdded) {
    const automations = await prisma.automation.findMany({
      where: { userId: contact.userId, isEnabled: true, trigger: 'contact_added' },
    });

    for (const automation of automations) {
      await triggerAutomation(automation, contact);
      results.automationsTriggered++;
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Run a campaign send by calling /api/campaigns/send in a loop, just like
 * the dashboard UI does. Stops when the campaign reports done, when the
 * time budget is exhausted, or when an error persists across retries.
 *
 * This is the canonical path: respects business hours, rate limits,
 * opt-in, dedup, human delays, batched processing.
 */
async function runCampaignSend(
  campaignId: string,
  userId: string,
  maxDurationMs: number = 9 * 60_000
): Promise<{ sent: number; failed: number; skipped: number; done: boolean; reason?: string }> {
  const deadline = Date.now() + maxDurationMs;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let lastError: string | undefined;
  let lastSent = 0;
  let lastFailed = 0;
  let lastSkipped = 0;
  let sameErrorStreak = 0;

  while (Date.now() < deadline) {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/campaigns/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Bypass cookie auth: cron jobs are trusted internal calls.
          // /api/campaigns/send validates X-Cron-Secret matches CRON_SECRET
          // env, then trusts the X-User-Id to look up the user.
          'X-Cron-Secret': process.env.CRON_SECRET || '',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ campaignId, batchSize: 3 }),
      });
    } catch (e: any) {
      // Network/timeout error
      sameErrorStreak++;
      if (sameErrorStreak >= 3) {
        return { sent: lastSent, failed: lastFailed, skipped: lastSkipped, done: false, reason: `network: ${e.message}` };
      }
      await sleep(5000);
      continue;
    }

    // 401 means the X-User-Id bypass didn't work — fail loudly
    if (res.status === 401) {
      throw new Error('cron: campaigns/send returned 401 (auth bypass not working)');
    }

    const data = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      // Route-level error (e.g. outside business hours, rate limited).
      // For 429 we want to back off and try again on next tick.
      if (res.status === 429) {
        return { sent: lastSent, failed: lastFailed, skipped: lastSkipped, done: false, reason: 'rate_limited' };
      }
      if (res.status === 403 && typeof data.error === 'string' && /business hour|8:00|20:00/i.test(data.error)) {
        return { sent: lastSent, failed: lastFailed, skipped: lastSkipped, done: false, reason: 'outside_business_hours' };
      }
      // Other errors — count and retry up to 3 times
      if (data.error === lastError) sameErrorStreak++;
      else sameErrorStreak = 1;
      lastError = data.error;
      if (sameErrorStreak >= 3) {
        return { sent: lastSent, failed: lastFailed, skipped: lastSkipped, done: false, reason: data.error };
      }
      await sleep(5000);
      continue;
    }

    // Success — reset error streak
    sameErrorStreak = 0;
    lastError = undefined;
    lastSent = data.sent ?? lastSent;
    lastFailed = data.failed ?? lastFailed;
    lastSkipped = data.skipped ?? lastSkipped;

    if (data.done) {
      return { sent: lastSent, failed: lastFailed, skipped: lastSkipped, done: true };
    }

    // Pause before next batch (matches dashboard UI pacing: 5-8s)
    await sleep(5000 + Math.floor(Math.random() * 3000));
  }

  return { sent: lastSent, failed: lastFailed, skipped: lastSkipped, done: false, reason: 'time_budget_exhausted' };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendWhatsApp(userId: string, phone: string, content: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/wacli/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, phone, message: content }),
  });
  if (!res.ok) throw new Error(`wacli failed: ${res.status}`);
}

async function sendEmail(userId: string, email: string, content: string) {
  // Uses Mailchimp transactional (Mandrill) or simple send
  // For now, log — email sending requires Mailchimp API setup
  console.log(`[cron] email to ${email}: ${content.substring(0, 50)}`);
}

async function sendSms(userId: string, phone: string, content: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, phone, message: content }),
  });
  if (!res.ok) throw new Error(`sms failed: ${res.status}`);
}

function getNextRecurrence(current: Date, recurrence: string): Date {
  const next = new Date(current);
  if (recurrence === 'DAILY') next.setDate(next.getDate() + 1);
  else if (recurrence === 'WEEKLY') next.setDate(next.getDate() + 7);
  else if (recurrence === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  return next;
}

async function triggerAutomation(automation: any, contact: any) {
  let actions: any[] = [];
  try { actions = JSON.parse(automation.actions); } catch {}

  actions.sort((a: any, b: any) => a.sequenceOrder - b.sequenceOrder);

  for (const action of actions) {
    const delayMs = (action.delayMinutes || 0) * 60 * 1000;
    const scheduledFor = new Date(Date.now() + delayMs);

    await prisma.dripScheduledMessage.create({
      data: {
        userId: contact.userId,
        contactId: contact.id,
        automationId: automation.id,
        channel: action.channel || 'whatsapp',
        template: action.template || '',
        scheduledFor,
        sequenceOrder: action.sequenceOrder || 0,
        status: 'PENDING',
      },
    });
  }

  await prisma.automation.update({
    where: { id: automation.id },
    data: { lastTriggered: new Date() },
  });

  await prisma.automationExecution.create({
    data: {
      automationId: automation.id,
      contactId: contact.id,
      event: 'triggered',
      payload: JSON.stringify({ trigger: 'contact_added', delay: 'scheduled' }),
    },
  });
}