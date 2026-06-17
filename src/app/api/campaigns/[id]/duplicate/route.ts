import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

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