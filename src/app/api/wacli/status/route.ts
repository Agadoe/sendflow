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

    // Daemon /wacli/status returns: { connected: bool, state: 'DISCONNECTED'|'QR_READY'|'CONNECTED'|'CONNECTING'|'RECOVERING'|'INIT_FAILED'|'AUTH_FAILED', phone?: string }
    const stateRaw = String(data.state || '').toUpperCase();
    let appState: string;
    if (data.connected === true || stateRaw === 'CONNECTED') {
      appState = 'CONNECTED';
    } else if (stateRaw === 'QR_READY') {
      appState = 'QR_READY';
    } else if (stateRaw === 'CONNECTING' || stateRaw === 'RECOVERING' || stateRaw === 'INITIALIZING' || stateRaw === 'STARTING' || stateRaw === 'RECONNECTING') {
      appState = 'CONNECTING';
    } else if (stateRaw === 'AUTH_FAILED' || stateRaw === 'INIT_FAILED') {
      appState = 'ERROR';
    } else {
      appState = 'DISCONNECTED';
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
