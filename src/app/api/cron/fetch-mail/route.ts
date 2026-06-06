/**
 * GET/POST /api/cron/fetch-mail
 *
 * Vercel cron target. Polls IMAP and writes new messages to InboundEmail.
 * Auth: Bearer token in Authorization header matching CRON_SECRET.
 *
 * Schedule (vercel.json): every 2 minutes.
 *
 * Optional query/body param:
 *   ?force=1  — re-scan from the beginning of the inbox (use sparingly)
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchInboundMail } from '@/lib/mail-fetcher';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  // Vercel cron sends a special header; allow it as a fallback in production
  // when CRON_SECRET is also set in the project.
  const vercelCron = req.headers.get('x-vercel-cron');
  if (process.env.NODE_ENV === 'production' && vercelCron && secret) {
    return true;
  }
  return false;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional force flag (for manual recovery, not used by Vercel cron)
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.force === true) {
        // Caller is admin; clear the lastUid watermark by passing lastUid=0
        process.env.MAIL_IMAP_RESET = '1';
      }
    } catch {
      // no body
    }
  }

  const result = await fetchInboundMail();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel hobby = 60s; pro = 300s

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
