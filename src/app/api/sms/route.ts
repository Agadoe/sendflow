import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

import { requirePlan } from '@/lib/plans';
import { getSmsProvider } from '@/lib/sms';

// GET /api/sms — provider config for the SMS dashboard page (cost preview +
// "is the gateway configured" badge). Non-secret values only.
export async function GET(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rateGhs = process.env.SMS_RATE_GHS ? parseFloat(process.env.SMS_RATE_GHS) : 0;
  return NextResponse.json({
    configured: !!process.env.SMS_API_KEY,
    provider: process.env.SMS_PROVIDER || 'arkesel',
    senderId: process.env.SMS_SENDER_ID || 'SendFlow',
    rateGhs: Number.isFinite(rateGhs) ? rateGhs : 0,
  });
}

// POST /api/sms — send a single SMS (used as the "send one test SMS" path to
// verify the provider key works end-to-end). Bulk sends go through campaigns.
export async function POST(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { requirePlan(session.plan, 'apiKeyAccess'); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status }); }

  const { phone, message } = await req.json();
  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400 });
  }

  const result = await getSmsProvider().send({ to: phone, message });
  if (!result.success) {
    return NextResponse.json({ error: result.reason || 'SMS send failed' }, { status: 400 });
  }
  return NextResponse.json({ success: true, messageId: result.messageId || null });
}