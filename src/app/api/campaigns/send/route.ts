import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { dispatchCampaign } from '@/lib/campaign-dispatch';

// ─── Route ────────────────────────────────────────────────────────────────────
// Thin HTTP + auth wrapper around the shared dispatch logic in
// @/lib/campaign-dispatch (also used by scripts/local-scheduler.ts). The paced
// send loop, rate limiting, business-hours gate, opt-in/dedup, and
// personalization all live there — one source of truth.
export async function POST(req: Request) {
  // Two auth paths:
  // 1. Normal: cookie session (dashboard UI)
  // 2. Trusted cron: X-Cron-Secret + X-User-Id headers (internal call from
  //    /api/cron/process, or the local scheduler if it ever routes through here)
  // Cron secret is rotated independently from JWT; if cron secret is missing in
  // env, the bypass is disabled and only cookie auth works.
  let user: any = null;
  const cronSecret = req.headers.get('x-cron-secret');
  const cronUserId = req.headers.get('x-user-id');
  if (cronSecret && cronSecret === process.env.CRON_SECRET && cronUserId) {
    user = await prisma.user.findUnique({
      where: { id: cronUserId },
      select: { id: true, timezone: true, plan: true, role: true },
    });
  } else {
    user = await getCurrentUser();
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { campaignId } = body;
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
  }

  const result = await dispatchCampaign({
    campaignId,
    userId: user.id,
    batchSize: Math.min(parseInt(body.batchSize || '3', 10), 5),
  });

  if (result.error) {
    // Map the dispatch outcomes back to the HTTP statuses the dashboard expects.
    if (result.outsideBusinessHours) {
      return NextResponse.json(
        { error: 'Messages can only be sent between 8:00 AM and 8:00 PM in your timezone.' },
        { status: 403 },
      );
    }
    if (result.rateLimited) {
      return NextResponse.json(
        { error: result.error, retryAfter: 60 },
        { status: 429 },
      );
    }
    // "Campaign not found" / "No contacts" / "User not found"
    const status = /not found/i.test(result.error) ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    processed: result.sent + result.failed + result.skipped,
    remaining: result.remaining,
    total: result.total,
    done: result.done,
  });
}