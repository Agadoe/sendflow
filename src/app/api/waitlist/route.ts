import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_DC = process.env.MAILCHIMP_DC || 'us10';
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_WAITLIST_LIST_ID;

const ADMIN_EMAIL = 'kaizensalesconsult@gmail.com';
const FROM_NAME = 'SendFlow';
const FROM_EMAIL = 'noreply@sendflow.africa';

function md5(text: string): string {
  return createHash('md5').update(text.toLowerCase()).digest('hex');
}

function mcBase() {
  return `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0`;
}

function mcAuth() {
  return `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')}`;
}

async function addToMailchimp(entry: {
  name: string;
  email: string;
  phone: string | null;
  businessType: string | null;
  wantsCall: boolean;
}) {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID) {
    console.warn('Mailchimp env vars missing — skipping sync');
    return;
  }

  const firstName = entry.name.split(' ')[0];
  const lastName = entry.name.slice(firstName.length).trim() || '';
  const hash = md5(entry.email);

  // Upsert member
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
          PHONE: entry.phone || '',
          BTYPE: entry.businessType || '',
          WANTCALL: entry.wantsCall ? 'YES' : 'NO',
        },
      }),
    }
  );

  if (!upsertRes.ok) {
    const err = await upsertRes.json().catch(() => ({}));
    console.error('Mailchimp upsert error:', err);
    return;
  }

  // Apply tags
  const tags = ['waitlist', entry.wantsCall ? 'wants-call' : 'no-call'];
  await fetch(`${mcBase()}/lists/${MAILCHIMP_LIST_ID}/members/${hash}/tags`, {
    method: 'POST',
    headers: { Authorization: mcAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: tags.map(t => ({ name: t, status: 'active' })) }),
  });
}

async function sendAdminEmail(entry: {
  name: string;
  email: string;
  phone: string | null;
  businessType: string | null;
  wantsCall: boolean;
}) {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID) return;

  // Create a draft campaign and send it to the admin
  const subject = entry.wantsCall
    ? `🔥 Hot Lead: ${entry.name} wants a call!`
    : `📋 New Signup: ${entry.name}`;

  const campaign = await fetch(`${mcBase()}/campaigns`, {
    method: 'POST',
    headers: { Authorization: mcAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'plaintext',
      recipients: { list_id: MAILCHIMP_LIST_ID },
      settings: {
        subject_line: subject,
        from_name: FROM_NAME,
        reply_to: FROM_EMAIL,
      },
    }),
  });

  if (!campaign.ok) return;
  const { id: campaignId } = await campaign.json();

  await fetch(`${mcBase()}/campaigns/${campaignId}/content`, {
    method: 'PUT',
    headers: { Authorization: mcAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plain_text: `
New SendFlow Waitlist Signup

Name: ${entry.name}
Email: ${entry.email}
Phone: ${entry.phone || '—'}
Business Type: ${entry.businessType || '—'}
Wants Onboarding Call: ${entry.wantsCall ? '✅ YES — PRIORITIZE' : '❌ No'}

—
SendFlow Waitlist Form
      `.trim(),
    }),
  });

  // Actually send it to the admin via Mailchimp
  await fetch(`${mcBase()}/campaigns/${campaignId}/actions/send`, {
    method: 'POST',
    headers: { Authorization: mcAuth() },
  });
}

export async function POST(req: Request) {
  try {
    const { name, email, phone, businessType, wantsCall } = await req.json();
    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
    }

    const entry = await prisma.waitlist.upsert({
      where: { email },
      update: { name, phone, businessType, wantsCall: wantsCall ?? false },
      create: { email, name, phone, businessType, wantsCall: wantsCall ?? false },
    });

    // Fire Mailchimp sync + admin notification without blocking the response
    Promise.all([
      addToMailchimp(entry),
      sendAdminEmail(entry),
    ]).catch(err => console.error('Background Mailchimp sync error:', err));

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const entries = await prisma.waitlist.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ count: entries.length, entries });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
  }
}
