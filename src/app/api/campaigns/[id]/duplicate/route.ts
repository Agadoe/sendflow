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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const original = await prisma.campaign.findFirst({ where: { id, userId } });
  if (!original) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { id: _omit, createdAt: _c, updatedAt: _u, sentAt: _s, ...rest } = original;

  const duplicate = await prisma.campaign.create({
    data: {
      ...rest,
      name: `${original.name} (Copy)`,
      status: 'DRAFT',
      scheduledAt: null,
      sentAt: null,
    },
  });

  return NextResponse.json({ campaign: duplicate }, { status: 201 });
}