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

  const forms = await prisma.whatsAppForm.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { submissions: true } } },
  });

  return NextResponse.json({ forms });
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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