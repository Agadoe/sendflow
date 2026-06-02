import { NextResponse } from 'next/server';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://127.0.0.1:4555';

// POST /disconnect → destroy WhatsApp session via daemon
export async function POST() {
  try {
    const res = await fetch(`${DAEMON_URL}/connect`, { method: 'POST' });
    const data = await res.json();
    return NextResponse.json({ success: true, state: data.state });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}