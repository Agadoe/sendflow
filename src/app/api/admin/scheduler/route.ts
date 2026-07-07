import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Admin-only control for the SendFlow scheduler (runs on the VPS at
// 127.0.0.1:4556, exposed via bore.pub:26657).
//
// The Vercel function can't SSH to the VPS directly (serverless
// runtime doesn't allow outbound shell), so we use a tiny HTTP
// admin service on the VPS that handles the toggle + state.
// Auth: same CRON_SECRET used by the cron path, passed as Bearer.
const ADMIN_URL = process.env.SCHEDULER_ADMIN_URL || 'http://bore.pub:26657';

async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'ADMIN' || user?.role === 'OWNER';
}

async function callAdmin(method: 'GET' | 'POST', body?: any) {
  const token = process.env.CRON_SECRET;
  if (!token) throw new Error('CRON_SECRET not set in env');

  const res = await fetch(`${ADMIN_URL}/state`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (method === 'GET') {
    if (!res.ok) throw new Error(`admin service returned ${res.status}`);
    return res.json();
  }

  // POST
  const postRes = await fetch(`${ADMIN_URL}/toggle`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!postRes.ok) throw new Error(`admin service returned ${postRes.status}`);
  return postRes.json();
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  try {
    const state = await callAdmin('GET');
    return NextResponse.json(state);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (action !== 'enable' && action !== 'disable') {
    return NextResponse.json({ error: 'action must be "enable" or "disable"' }, { status: 400 });
  }

  try {
    const result = await callAdmin('POST', { action });

    // Audit log — best-effort, don't fail the toggle if logging fails
    await (prisma as any).auditLog.create({
      data: {
        userId: user!.id,
        action: `scheduler.${action}`,
        target: 'sendflow-scheduler',
        metadata: JSON.stringify({ actor: user!.email, result }),
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
