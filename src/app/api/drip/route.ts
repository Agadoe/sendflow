import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'PENDING';

  const messages = await prisma.dripScheduledMessage.findMany({
    where: { userId, status: status.toUpperCase() },
    orderBy: { scheduledFor: 'asc' },
    take: 100,
    include: {
      contact: { select: { name: true, phone: true } },
      automation: { select: { name: true } },
    },
  });

  return NextResponse.json({ messages });
}