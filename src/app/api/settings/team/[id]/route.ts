import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role === 'VIEWER' || session.role === 'EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  await prisma.teamMember.deleteMany({ where: { userId: id } });
  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'ADMIN' && !session.isOwner) {
    return NextResponse.json({ error: 'Only admins can change roles' }, { status: 403 });
  }

  const { id } = await params;
  const { role } = await req.json();

  if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  await prisma.teamMember.updateMany({
    where: { userId: id },
    data: { role },
  });

  return NextResponse.json({ success: true });
}