import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

async function getUserIdFromCookie(cookieHeader: string | null): Promise<string | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], JWT_SECRET);
    return payload.sub as string;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = await getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
