import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchDaemon, formatPhone, DAEMON_URL } from '@/lib/daemon-fetch';



export async function GET() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch status from the daemon (uses /health which returns { connection })
    const res = await fetchDaemon('/wacli/status', {
      headers: {
        'X-User-Id': user.id
      }
    });

    if (!res.ok) {
      // Daemon error — WhatsApp might be down or starting
      return NextResponse.json({ connected: false, state: 'daemon_error', detail: `HTTP ${res.status}` });
    }

    const data = await res.json();

    // Exhaustive state mapping from daemon → app
    // Daemon /wacli/health returns: { status: "ok", connection: "open"|"close"|"connecting", ... }
    // We must check `data.connection` explicitly — `data.status` is "ok" even when connected.
    const connectionState = data.connection; // "open" | "close" | "connecting" | undefined
    let appState: string;
    if (data.connected === true || connectionState === 'open') {
      appState = 'CONNECTED';
    } else if (connectionState === 'close' || connectionState === 'disconnected') {
      appState = 'DISCONNECTED';
    } else if (data.qr || data.status === 'QR_READY') {
      appState = 'QR_READY';
    } else if (connectionState === 'connecting' || data.status === 'connecting' || data.status === 'waiting' || data.status === 'INITIALIZING' || data.status === 'STARTING' || data.status === 'RECONNECTING') {
      appState = 'CONNECTING';
    } else {
      appState = connectionState || data.status || 'DISCONNECTED';
    }

    // Only write to DB if state actually changed — prevents hammering the DB
    // every 2 seconds while polling
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { wacliStatus: true, wacliPhone: true }
    });

    const phone = data.phone || data.info?.pushName || null;
    const stateChanged = currentUser?.wacliStatus !== appState;
    const phoneChanged = currentUser?.wacliPhone !== phone;
    const isNowConnected = appState === 'CONNECTED';
    // wasConnectedAt is the DB value — only update when we transition INTO connected
    const transitioningToConnected = isNowConnected && currentUser?.wacliStatus !== 'CONNECTED';

    if (stateChanged || phoneChanged || transitioningToConnected) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          wacliStatus: appState,
          wacliPhone: phone,
          ...(transitioningToConnected ? { wacliLastConnectedAt: new Date() } : {})
        }
      });
    }

    // Return unified shape to the client
    return NextResponse.json({
      connected: appState === 'CONNECTED',
      state: appState,
      phone: phone,
      info: data.info || null
    });
  } catch (error) {
    console.error('Error fetching wacli status:', error);
    // Fetch failed entirely — daemon is not reachable
    return NextResponse.json({ connected: false, state: 'unreachable' });
  }
}
