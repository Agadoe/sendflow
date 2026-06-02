import { NextResponse } from 'next/server';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://127.0.0.1:4555';

// POST /connect → regenerate QR and reconnect
export async function POST() {
  try {
    const res = await fetch(`${DAEMON_URL}/connect`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json({ success: true, state: data.state });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to reconnect: ' + e.message }, { status: 500 });
  }
}

// GET /connect → get current QR
export async function GET() {
  try {
    const res = await fetch(`${DAEMON_URL}/qr`);
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json({ qr: data.qr, state: data.state, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get QR: ' + e.message }, { status: 500 });
  }
}