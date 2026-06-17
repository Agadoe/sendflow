import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;
  const automation = await prisma.automation.findFirst({ where: { id, userId } });
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ automation });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;
  const existing = await prisma.automation.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.automation.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      trigger: body.trigger ?? existing.trigger,
      triggerConfig: body.triggerConfig ?? existing.triggerConfig,
      conditions: body.conditions ?? existing.conditions,
      actions: body.actions ?? existing.actions,
      isEnabled: body.isEnabled ?? existing.isEnabled,
    },
  });

  return NextResponse.json({ automation: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;
  const existing = await prisma.automation.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.automation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
