import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

import { requirePlan } from '@/lib/plans';

const MAX_BULK_SMS = 100;

export async function POST(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { requirePlan(session.plan, 'apiKeyAccess'); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status }); }
  const userId = session.id;

  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Termii not configured' }, { status: 500 });
  }

  const { contacts, message } = await req.json();
  if (!contacts || !message) {
    return NextResponse.json({ error: 'contacts and message required' }, { status: 400 });
  }
  if (!Array.isArray(contacts) || contacts.length > MAX_BULK_SMS) {
    return NextResponse.json({ error: `Maximum ${MAX_BULK_SMS} contacts per request` }, { status: 400 });
  }

  const results: { phone: string; success: boolean; messageId?: string }[] = [];

  for (const contact of contacts) {
    const phone = contact.phone;
    try {
      const res = await fetch('https://api.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, to: phone, from: 'SendFlow', message, channel: 'dnd' }),
      });
      const data = await res.json();
      results.push({ phone, success: data.status === 'success' || data.code === 'ok', messageId: data.message_id });
    } catch {
      results.push({ phone, success: false });
    }
  }

  const sent = results.filter(r => r.success).length;
  return NextResponse.json({ total: contacts.length, sent, failed: contacts.length - sent, results });
}
