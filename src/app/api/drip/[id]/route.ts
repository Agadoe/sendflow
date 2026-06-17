import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { requirePlan } from '@/lib/plans';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { requirePlan(session.plan, 'dripMessaging'); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: e.status }); }
  const userId = session.id;

  const { id } = await params;

  const existing = await prisma.dripScheduledMessage.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: 'Can only cancel pending messages' }, { status: 400 });
  }

  await prisma.dripScheduledMessage.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json({ success: true });
}