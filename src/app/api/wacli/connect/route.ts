import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchDaemon, formatPhone, DAEMON_URL } from '@/lib/daemon-fetch';



// POST /connect → regenerate QR and reconnect
export async function POST() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetchDaemon('/wacli/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body: JSON.stringify({})
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    // Map daemon status to app state. The daemon returns status values like:
    // 'already_connected', 'connecting', 'waiting', 'error', etc.
    // Do NOT assume QR_READY — the QR isn't generated until 3–8s after init.
    const daemonStatus = data.status || data.state;
    let appState: string;
    if (daemonStatus === 'already_connected' || daemonStatus === 'CONNECTED') {
      appState = 'CONNECTED';
    } else if (daemonStatus === 'connecting' || daemonStatus === 'RECONNECTING') {
      appState = 'CONNECTING';
    } else {
      appState = 'CONNECTING'; // QR not ready yet — UI should poll
    }

    // Update user's wacli status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        wacliStatus: appState
      }
    });

    return NextResponse.json({ success: true, state: appState });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to reconnect: ' + e.message }, { status: 500 });
  }
}

// GET /connect → get current QR
export async function GET() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetchDaemon('/wacli/qr', {
      headers: {
        'X-User-Id': user.id
      }
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    // Exhaustive state mapping — prevents CONNECTING being overwritten by DISCONNECTED
    const daemonStatus = data.status || data.state;
    const qr = data.qr || null;
    let appState: string;
    if (daemonStatus === 'already_connected' || daemonStatus === 'CONNECTED') {
      appState = 'CONNECTED';
    } else if (qr) {
      appState = 'QR_READY';
    } else if (daemonStatus === 'waiting' || daemonStatus === 'connecting' || daemonStatus === 'INITIALIZING' || daemonStatus === 'STARTING' || daemonStatus === 'RECONNECTING') {
      appState = 'CONNECTING';
    } else {
      appState = 'DISCONNECTED';
    }

    // Update user's QR code and status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        wacliQrCode: qr,
        wacliStatus: appState
      }
    });

    return NextResponse.json({ qr, state: appState, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get QR: ' + e.message }, { status: 500 });
  }
}
