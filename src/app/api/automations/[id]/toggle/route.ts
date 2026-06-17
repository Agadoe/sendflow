import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;

  const existing = await prisma.automation.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.automation.update({
    where: { id },
    data: { isEnabled: !existing.isEnabled },
  });

  return NextResponse.json({ automation: updated });
}