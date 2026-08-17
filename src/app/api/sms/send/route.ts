import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

import { requirePlan } from '@/lib/plans';
import { getSmsProvider } from '@/lib/sms';

const MAX_BULK_SMS = 100;

// POST /api/sms/send — send the same message to a list of contacts (max 100).
// Backs the legacy lead-nurturing cron sms branch (/api/cron/process) and any
// direct bulk caller. Repointed from Termii to the provider layer (src/lib/sms).
// For campaign-grade sends (segments, scheduling, opt-in/STOP compliance,
// delivery tracking), create a channel="sms" campaign via /api/campaigns.
export async function POST(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { requirePlan(session.plan, 'apiKeyAccess'); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status }); }

  const { contacts, message } = await req.json();
  if (!contacts || !message) {
    return NextResponse.json({ error: 'contacts and message required' }, { status: 400 });
  }
  if (!Array.isArray(contacts) || contacts.length > MAX_BULK_SMS) {
    return NextResponse.json({ error: `Maximum ${MAX_BULK_SMS} contacts per request` }, { status: 400 });
  }

  const provider = getSmsProvider();
  const results: { phone: string; success: boolean; messageId?: string | null }[] = [];
  for (const contact of contacts) {
    const phone = contact.phone;
    try {
      const r = await provider.send({ to: phone, message });
      results.push({ phone, success: r.success, messageId: r.messageId || null });
    } catch {
      results.push({ phone, success: false });
    }
  }

  const sent = results.filter((r) => r.success).length;
  return NextResponse.json({ total: contacts.length, sent, failed: contacts.length - sent, results });
}