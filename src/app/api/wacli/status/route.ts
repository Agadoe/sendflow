import { NextResponse } from 'next/server';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://127.0.0.1:4555';

export async function GET() {
  try {
    const res = await fetch(`${DAEMON_URL}/status`);
    if (!res.ok) {
      // Daemon error — WhatsApp might be down or starting
      return NextResponse.json({ connected: false, state: 'daemon_error', detail: `HTTP ${res.status}` });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Fetch failed entirely — daemon is not reachable
    return NextResponse.json({ connected: false, state: 'unreachable' });
  }
}