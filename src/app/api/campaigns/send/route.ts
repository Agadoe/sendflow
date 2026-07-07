import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import https from 'https';
import http from 'http';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131';

// ─── In-Memory Rate Limit (resets on cold start; use Redis in production) ───
const rateMap = new Map<string, any>();
const MAX_PER_MINUTE = 20;
const MAX_PER_DAY = 300;

function checkRateLimit(userId: string): { ok: boolean; retryAfter?: number; reason?: string } {
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

// ─── Native fetch for daemon ────────────────────────────────────────────────
function fetchDaemon(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DAEMON_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode || 0,
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
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
    return hour >= 8 && hour < 20;
  } catch {
    return true;
  }
}

function personalize(content: string, name?: string | null): string {
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

function isDuplicate(contact: any, content: string): boolean {
  if (!contact.lastMessageContent || !contact.lastMessageSentAt) return false;
  const daysSince = (Date.now() - new Date(contact.lastMessageSentAt).getTime()) / 86_400_000;
  return contact.lastMessageContent === content && daysSince < 7;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getHumanDelay(index: number): number {
  const base = 4000 + Math.floor(Math.random() * 8000);
  if (index > 0 && index % 5 === 0) return 15000 + Math.floor(Math.random() * 20000);
  if (index > 0 && index % 10 === 0) return 30000 + Math.floor(Math.random() * 30000);
  return base;
}

async function sendViaDaemon(userId: string, phone: string, message: string): Promise<void> {
  const res = await fetchDaemon('/wacli/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    // Daemon expects { to, message } — not { phone, message }.
    // Sending 'phone' returned a 400 'to and message are required' for months.
    body: JSON.stringify({ to: phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || err.message || `Daemon returned ${res.status}`);
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { campaignId } = body;
  const batchSize = Math.min(parseInt(body.batchSize || '3', 10), 5); // max 5 per batch

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

  // Mark SENDING if this is the first batch (campaign status is DRAFT or SCHEDULED)
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

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // If first batch, mark campaign as SENDING
  if (campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING', sentAt: new Date() },
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < campaign.messages.length; i++) {
    const msg = campaign.messages[i];
    const contact = msg.contact;
    const baseContent = campaign.content;

    if (!contact.optedIn) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SKIPPED', failureReason: 'Contact has not opted in to WhatsApp messages' },
      });
      skipped++;
      continue;
    }

    if (isDuplicate(contact, baseContent)) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SKIPPED', failureReason: 'Duplicate message sent within 7 days' },
      });
      skipped++;
      continue;
    }

    const personalized = personalize(baseContent, contact.name);
    const delay = getHumanDelay(i);
    await sleep(delay);

    const midCheck = checkRateLimit(user.id);
    if (!midCheck.ok) {
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
    } catch (e: any) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'FAILED', failureReason: e.message },
      });
      failed++;
    }
  }

  // Count remaining pending
  const remainingPending = await prisma.message.count({
    where: { campaignId, status: 'PENDING' },
  });

  // If nothing remaining, mark final status
  if (remainingPending === 0) {
    const totalMessages = await prisma.message.count({ where: { campaignId } });
    const sentCount = await prisma.message.count({ where: { campaignId, status: 'SENT' } });
    const finalStatus = sentCount > 0 ? 'SENT' : 'FAILED';
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus },
    });
  }

  return NextResponse.json({
    sent,
    failed,
    skipped,
    processed: sent + failed + skipped,
    remaining: remainingPending,
    total: await prisma.message.count({ where: { campaignId } }),
    done: remainingPending === 0,
  });
}
