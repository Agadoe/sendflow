import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://127.0.0.1:4555';

function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

export async function POST(req: Request) {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone, message } = await req.json();

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message required' }, { status: 400 });
    }

    const formatted = formatPhone(phone);
    const body = JSON.stringify({ phone: formatted, message });

    const res = await fetch(`${DAEMON_URL}/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body,
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
