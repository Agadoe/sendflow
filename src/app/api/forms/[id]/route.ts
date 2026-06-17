import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;

  const form = await prisma.whatsAppForm.findFirst({
    where: { id, userId },
    include: {
      submissions: { orderBy: { createdAt: 'desc' }, take: 50 },
      _count: { select: { submissions: true } },
    },
  });

  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ form });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;
  const body = await req.json();
  const { name, phone, prefillMsg, questions, tagName, tagValue, isActive } = body;

  const existing = await prisma.whatsAppForm.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.whatsAppForm.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      phone: phone ? phone.replace(/\D/g, '') : existing.phone,
      prefillMsg: prefillMsg ?? existing.prefillMsg,
      questions: questions ? JSON.stringify(questions) : existing.questions,
      tagName: tagName ?? existing.tagName,
      tagValue: tagValue ?? existing.tagValue,
      isActive: isActive ?? existing.isActive,
    },
  });

  return NextResponse.json({ form: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;
  await prisma.whatsAppForm.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;
  const body = await req.json();
  const existing = await prisma.whatsAppForm.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.whatsAppForm.update({
    where: { id },
    data: { isActive: body.isActive },
  });

  return NextResponse.json({ form: updated });
}