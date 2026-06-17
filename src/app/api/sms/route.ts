import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

import { requirePlan } from '@/lib/plans';

export async function POST(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { requirePlan(session.plan, 'apiKeyAccess'); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status }); }
  const userId = session.id;

  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Termii not configured. Add TERMII_API_KEY to .env.local' }, { status: 500 });
  }

  const { phone, message, channel = 'dnd' } = await req.json();
  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, to: phone, from: 'SendFlow', message, channel }),
    });
    const data = await res.json();

    if (data.status === 'success' || data.code === 'ok') {
      return NextResponse.json({ success: true, messageId: data.message_id || data.pickup_id });
    }

    return NextResponse.json({ error: data.message || 'SMS send failed', details: data }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Termii API error' }, { status: 500 });
  }
}
