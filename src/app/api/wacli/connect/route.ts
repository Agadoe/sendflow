import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import https from 'https';
import http from 'http';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131';

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
    
    // Translate daemon { status: 'connecting' | 'already_connected' | 'error' } → app state
    const state = data.status === 'already_connected' ? 'CONNECTED' : 'QR_READY';
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        wacliStatus: state
      }
    });
    
    return NextResponse.json({ success: true, state });
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
    
    // Translate daemon { status, qr } → app { qr, state }
    let appState: string = 'QR_READY';
    if (data.status === 'already_connected') appState = 'CONNECTED';
    else if (data.status === 'waiting') appState = 'CONNECTING';
    else if (!data.qr) appState = 'DISCONNECTED';
    
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        wacliQrCode: data.qr || null,
        wacliStatus: appState
      }
    });
    
    return NextResponse.json({ qr: data.qr, state: appState, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get QR: ' + e.message }, { status: 500 });
  }
}