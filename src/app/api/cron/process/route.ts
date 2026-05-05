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
    try {
      if (msg.channel === 'whatsapp') {
        await sendWhatsApp(msg.userId, msg.contact.phone, msg.template);
      } else if (msg.channel === 'email') {
        await sendEmail(msg.userId, msg.contact.phone, msg.template);
      } else if (msg.channel === 'sms') {
        await sendSms(msg.userId, msg.contact.phone, msg.template);
      }

      await prisma.dripScheduledMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      results.drip.sent++;
    } catch (err: any) {
      await prisma.dripScheduledMessage.update({
        where: { id: msg.id },
        data: { status: 'FAILED', failureReason: err.message },
      });
      results.drip.failed++;
    }
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
    include: {
      user: true,
      messages: { include: { contact: true } },
    },
  });

  results.recurring = { found: recurringCampaigns.length, sent: 0 };

  for (const campaign of recurringCampaigns) {
    try {
      for (const message of campaign.messages) {
        if (message.status === 'PENDING') {
          await sendWhatsApp(campaign.userId, message.contact.phone, campaign.content);
          await prisma.message.update({
            where: { id: message.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
          results.recurring.sent++;
        }
      }

      // Advance to next recurrence
      const nextDate = getNextRecurrence(campaign.scheduledAt!, campaign.recurrence!);
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { scheduledAt: nextDate },
      });
    } catch (err: any) {
      results.recurring.error = err.message;
    }
  }

  // ── 3. Scheduled (one-time) campaigns due now ────────────────────────────
  const dueCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      recurrence: null,
      scheduledAt: { lte: now },
    },
    include: {
      user: true,
      messages: { include: { contact: true } },
    },
  });

  results.campaigns = { found: dueCampaigns.length, sent: 0, failed: 0 };

  for (const campaign of dueCampaigns) {
    try {
      for (const message of campaign.messages) {
        if (message.status === 'PENDING') {
          await sendWhatsApp(campaign.userId, message.contact.phone, campaign.content);
          await prisma.message.update({
            where: { id: message.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
          results.campaigns.sent++;
        }
      }

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err: any) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED' },
      });
      results.campaigns.failed++;
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