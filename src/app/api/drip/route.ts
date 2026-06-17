import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { requirePlan } from '@/lib/plans';

export async function GET(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { requirePlan(session.plan, 'dripMessaging'); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status }); }
  const userId = session.id;

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