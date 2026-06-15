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
    return NextResponse.json({ error: 'Termii not configured' }, { status: 500 });
  }

  const { contacts, message } = await req.json();
  if (!contacts || !message) {
    return NextResponse.json({ error: 'contacts and message required' }, { status: 400 });
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
