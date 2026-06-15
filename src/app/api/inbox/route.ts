/**
 * /api/inbox — Inbound email management (auth required)
 *
 * GET    /api/inbox?limit=50&unread=true&q=search
 *   → list emails from InboundEmail
 *   → q matches subject, fromName, fromAddress, snippet
 *
 * GET /api/inbox/:id  (handled in [id]/route.ts)
 * PATCH  /api/inbox      body: { id, read }
 * DELETE /api/inbox?id=… 
 */
import { JWT_SECRET } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchInboundMail } from '@/lib/mail-fetcher';

async function getUserFromJwt(req: NextRequest): Promise<string | null> {
  const { jwtVerify } = await import('jose');
  const token = req.cookies.get('sf_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserFromJwt(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
  const unread = url.searchParams.get('unread') === 'true';
  const q = (url.searchParams.get('q') || '').trim();
  const fetchNow = url.searchParams.get('fetch') === '1';

  // Optionally trigger an IMAP fetch on demand (used by the "Refresh" button)
  let fetchResult: unknown = null;
  if (fetchNow) {
    try {
      fetchResult = await fetchInboundMail();
    } catch (e) {
      fetchResult = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  const where: any = {};
  if (unread) where.read = false;
  if (q) {
    where.OR = [
      { subject: { contains: q } },
      { fromName: { contains: q } },
      { fromAddress: { contains: q } },
      { snippet: { contains: q } },
    ];
  }

  const [emails, total, unreadCount] = await Promise.all([
    prisma.inboundEmail.findMany({
      where,
      orderBy: [{ receivedAt: 'desc' }, { uid: 'desc' }],
      take: limit,
      select: {
        id: true,
        uid: true,
        fromAddress: true,
        fromName: true,
        toAddress: true,
        subject: true,
        snippet: true,
        receivedAt: true,
        sentAt: true,
        read: true,
        readAt: true,
        attachments: true,
        matchedContactId: true,
        fetchedAt: true,
      },
    }),
    prisma.inboundEmail.count(),
    prisma.inboundEmail.count({ where: { read: false } }),
  ]);

  return NextResponse.json({
    emails,
    total,
    unreadCount,
    limit,
    fetchResult,
  });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserFromJwt(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, read } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updated = await prisma.inboundEmail.update({
    where: { id },
    data: {
      read: Boolean(read),
      readAt: read ? new Date() : null,
      readBy: read ? userId : null,
    },
  });
  return NextResponse.json({ email: updated });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserFromJwt(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.inboundEmail.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
