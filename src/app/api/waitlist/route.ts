import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_DC = process.env.MAILCHIMP_DC || 'us10';
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_WAITLIST_LIST_ID;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_NOTIFY_CHAT = process.env.TELEGRAM_NOTIFY_CHAT; // Don's chat id for alerts

const FROM_NAME = 'SendFlow';
const FROM_EMAIL = 'noreply@sendflow.africa';

// ---------- helpers ----------

function md5(text: string): string {
  return createHash('md5').update(text.toLowerCase()).digest('hex');
}

function mcBase() {
  return `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0`;
}

function mcAuth() {
  return `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')}`;
}

// Normalize any phone string to E.164.
// Accepts: 233XXXXXXXXX, 0XXXXXXXXX, +233XXXXXXXXX, raw digits with spaces/dashes.
function normalizePhone(raw: string): { e164: string; valid: boolean; country: string } {
  if (!raw) return { e164: '', valid: false, country: 'unknown' };
  const digits = raw.replace(/[^\d+]/g, '');
  // Strip leading + if present for parsing
  const d = digits.startsWith('+') ? digits.slice(1) : digits;
  let e164 = '';
  if (d.startsWith('233') && d.length === 12) e164 = '+' + d;
  else if (d.startsWith('0') && d.length === 10) e164 = '+233' + d.slice(1);
  else if (d.length === 9) e164 = '+233' + d; // bare 9-digit local
  else if (d.length === 12 && d.startsWith('234')) e164 = '+' + d; // Nigeria
  else if (d.length === 12 && d.startsWith('254')) e164 = '+' + d; // Kenya
  else if (d.length === 12 && d.startsWith('27')) e164 = '+' + d;  // SA
  else if (d.length >= 11 && d.length <= 15) e164 = '+' + d;       // generic international
  return {
    e164,
    valid: /^\+\d{11,15}$/.test(e164),
    country: e164.startsWith('+233') ? 'GH' : e164.startsWith('+234') ? 'NG' : e164.startsWith('+254') ? 'KE' : e164.startsWith('+27') ? 'ZA' : 'other',
  };
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function clientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return req.headers.get('x-real-ip') || null;
}

// ---------- Mailchimp sync ----------

async function syncMailchimp(entry: {
  email: string; name: string; phone: string; businessType: string | null; wantsCall: boolean;
}) {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID) {
    return { ok: false, error: 'MAILCHIMP_API_KEY or MAILCHIMP_WAITLIST_LIST_ID missing in env' };
  }
  const firstName = entry.name.split(' ')[0] || entry.name;
  const lastName = entry.name.slice(firstName.length).trim() || '';
  const hash = md5(entry.email);

  const upsertRes = await fetch(
    `${mcBase()}/lists/${MAILCHIMP_LIST_ID}/members/${hash}`,
    {
      method: 'PUT',
      headers: { Authorization: mcAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_address: entry.email,
        status_if_new: 'subscribed',
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
          PHONE: entry.phone,
          BTYPE: entry.businessType || '',
          WANTCALL: entry.wantsCall ? 'YES' : 'NO',
        },
      }),
    }
  );
  if (!upsertRes.ok) {
    const err = await upsertRes.json().catch(() => ({}));
    return { ok: false, error: `Mailchimp upsert ${upsertRes.status}: ${JSON.stringify(err)}` };
  }

  // Apply tags
  const tagRes = await fetch(`${mcBase()}/lists/${MAILCHIMP_LIST_ID}/members/${hash}/tags`, {
    method: 'POST',
    headers: { Authorization: mcAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tags: [
        { name: 'waitlist', status: 'active' },
        { name: entry.wantsCall ? 'wants-call' : 'no-call', status: 'active' },
      ],
    }),
  });
  if (!tagRes.ok) {
    const err = await tagRes.json().catch(() => ({}));
    return { ok: false, error: `Mailchimp tags ${tagRes.status}: ${JSON.stringify(err)}` };
  }
  return { ok: true };
}

// ---------- Telegram notify ----------

async function notifyTelegram(submission: {
  name: string; email: string; phone: string; businessType: string | null; wantsCall: boolean;
}) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_NOTIFY_CHAT) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_NOTIFY_CHAT missing' };
  }
  const text = [
    '🆕 *SendFlow Waitlist*',
    '',
    `👤 *${submission.name}*`,
    `📧 ${submission.email}`,
    `📱 ${submission.phone}`,
    `🏷 ${submission.businessType || '—'}`,
    `📞 Wants call: ${submission.wantsCall ? '✅ YES' : '❌ no'}`,
  ].join('\n');
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_NOTIFY_CHAT,
      text,
      parse_mode: 'Markdown',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: `Telegram ${res.status}: ${JSON.stringify(err)}` };
  }
  return { ok: true };
}

// ---------- handlers ----------

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, email, phone, businessType, wantsCall } = body;

  if (!name || !email || !phone) {
    return NextResponse.json(
      { error: 'Name, email, and phone are all required.' },
      { status: 400 }
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please use a valid email address.' }, { status: 400 });
  }
  const norm = normalizePhone(String(phone));
  if (!norm.valid) {
    return NextResponse.json(
      { error: 'Please use a valid phone number (Ghana, Nigeria, Kenya, SA, or any international with country code).' },
      { status: 400 }
    );
  }

  const wantsCallBool = Boolean(wantsCall);

  try {
    // 1) Upsert Waitlist (canonical record)
    const entry = await prisma.waitlist.upsert({
      where: { email },
      update: { name, phone: norm.e164, businessType: businessType || null, wantsCall: wantsCallBool },
      create: { email, name, phone: norm.e164, businessType: businessType || null, wantsCall: wantsCallBool },
    });

    // 2) Write the immutable audit row
    const submission = await prisma.waitlistSubmission.create({
      data: {
        waitlistId: entry.id,
        email,
        name,
        phone: String(phone),
        phoneE164: norm.e164,
        businessType: businessType || null,
        wantsCall: wantsCallBool,
        source: 'landing',
        ip: clientIp(req),
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    // 3) Fire-and-forget destination syncs, but record outcome on the submission row
    Promise.all([
      syncMailchimp({ email, name, phone: norm.e164, businessType: businessType || null, wantsCall: wantsCallBool })
        .then(async (r) => {
          await prisma.waitlistSubmission.update({
            where: { id: submission.id },
            data: {
              mailchimpStatus: r.ok ? 'synced' : 'failed',
              mailchimpError: r.ok ? null : r.error || 'unknown',
              mailchimpSyncedAt: r.ok ? new Date() : null,
            },
          });
        })
        .catch((e) =>
          prisma.waitlistSubmission.update({
            where: { id: submission.id },
            data: { mailchimpStatus: 'failed', mailchimpError: String(e?.message || e) },
          }).catch(() => {})
        ),
      notifyTelegram({ email, name, phone: norm.e164, businessType: businessType || null, wantsCall: wantsCallBool })
        .then(async (r) => {
          await prisma.waitlistSubmission.update({
            where: { id: submission.id },
            data: {
              telegramStatus: r.ok ? 'synced' : 'failed',
              telegramError: r.ok ? null : r.error || 'unknown',
              telegramSyncedAt: r.ok ? new Date() : null,
            },
          });
        })
        .catch((e) =>
          prisma.waitlistSubmission.update({
            where: { id: submission.id },
            data: { telegramStatus: 'failed', telegramError: String(e?.message || e) },
          }).catch(() => {})
        ),
    ]).catch((e) => console.error('[waitlist] sync fan-out error:', e));

    return NextResponse.json({ success: true, entry, submissionId: submission.id, phoneE164: norm.e164 });
  } catch (err: any) {
    console.error('[waitlist] POST error:', err);
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const [entries, submissions, mailchimpFailed, telegramFailed] = await Promise.all([
      prisma.waitlist.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.waitlistSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.waitlistSubmission.count({ where: { mailchimpStatus: 'failed' } }),
      prisma.waitlistSubmission.count({ where: { telegramStatus: 'failed' } }),
    ]);
    return NextResponse.json({
      count: entries.length,
      submissionsCount: submissions.length,
      syncHealth: { mailchimpFailed, telegramFailed },
      entries,
      recentSubmissions: submissions,
    });
  } catch (err) {
    console.error('[waitlist] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
  }
}
