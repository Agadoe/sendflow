import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchDaemon, formatPhone, DAEMON_URL } from '@/lib/daemon-fetch';




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
    // Daemon expects { to, message } — not { phone, message }.
    const body = JSON.stringify({ to: formatted, message });

    const res = await fetchDaemon('/wacli/send', {
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
