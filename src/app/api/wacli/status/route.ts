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
    const url = new URL(path, DAEMON_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
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

    // Fetch status from the daemon (uses /health which returns { connection })
    console.log("DEBUG: DAEMON_URL =", DAEMON_URL);
    const testUrl = new URL("/health", DAEMON_URL);
    console.log("DEBUG: fetch URL =", testUrl.href);    const res = await fetchDaemon('/health', {
      headers: {
        'X-User-Id': user.id
      }
    });
    
    if (!res.ok) {
      // Daemon error — WhatsApp might be down or starting
      return NextResponse.json({ connected: false, state: 'daemon_error', detail: `HTTP ${res.status}` });
    }
    
    const data = await res.json();
    
    // Translate daemon { status, connection } → app { connected, state, phone }
    const isOpen = data.connection === 'open';
    const state = isOpen ? 'CONNECTED'
      : data.status === 'error' ? 'ERROR'
      : 'DISCONNECTED';
    
    // Update user's wacli status in the database
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        wacliStatus: state,
        wacliPhone: null, // daemon does not expose phone number
        wacliLastConnectedAt: isOpen ? new Date() : null
      }
    });
    
    return NextResponse.json({ connected: isOpen, state, phone: null });
  } catch (error) {
    console.error('Error fetching wacli status:', error);
    // Fetch failed entirely — daemon is not reachable
    return NextResponse.json({ connected: false, state: 'unreachable' });
  }
}