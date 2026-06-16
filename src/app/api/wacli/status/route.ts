import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import https from 'https';
import http from 'http';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131/wacli/';

function fetchDaemon(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const base = new URL(DAEMON_URL);
    // Preserve base path prefix (e.g. /wacli/) instead of letting a leading
    // slash on `path` replace the entire pathname.
    let basePath = base.pathname;
    if (!basePath.endsWith('/')) basePath += '/';
    base.pathname = basePath + path.replace(/^\//, '');

    const client = base.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: base.hostname,
        port: base.port || undefined,
        path: base.pathname + base.search,
        method: options.method || 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode || 0,
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function GET() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch status from the multi-tenant daemon
    const res = await fetchDaemon('/status', {
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
    const daemonStatus = data.status || data.state || data.connection;
    let appState: string;
    if (data.connected === true || daemonStatus === 'CONNECTED' || daemonStatus === 'open') {
      appState = 'CONNECTED';
    } else if (daemonStatus === 'QR_READY') {
      appState = 'QR_READY';
    } else if (daemonStatus === 'connecting' || daemonStatus === 'waiting' || daemonStatus === 'INITIALIZING' || daemonStatus === 'STARTING' || daemonStatus === 'RECONNECTING') {
      appState = 'CONNECTING';
    } else {
      appState = daemonStatus || 'DISCONNECTED';
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

    if (stateChanged || phoneChanged) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          wacliStatus: appState,
          wacliPhone: phone,
          ...(data.connected ? { wacliLastConnectedAt: new Date() } : {})
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