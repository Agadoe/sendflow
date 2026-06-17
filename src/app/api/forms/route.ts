import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const forms = await prisma.whatsAppForm.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { submissions: true } } },
  });

  return NextResponse.json({ forms });
}

export async function POST(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { name, phone, prefillMsg, questions, tagName, tagValue } = await req.json();
  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
  }

  const form = await prisma.whatsAppForm.create({
    data: {
      userId,
      name,
      phone: phone.replace(/\D/g, ''),
      prefillMsg: prefillMsg || null,
      questions: JSON.stringify(questions || []),
      tagName: tagName || null,
      tagValue: tagValue || null,
    },
  });

  return NextResponse.json({ form }, { status: 201 });
}