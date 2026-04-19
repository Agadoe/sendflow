import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = cookieHeader ? cookieHeader.match(/sf_token=([^;]+)/)?.[1] : null;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ contacts });
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = cookieHeader ? cookieHeader.match(/sf_token=([^;]+)/)?.[1] : null;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { contacts } = await req.json();
  if (!Array.isArray(contacts)) {
    return NextResponse.json({ error: 'contacts array required' }, { status: 400 });
  }

  const created = await Promise.all(
    contacts.map((c: { phone: string; name?: string; tags?: string[] }) =>
      prisma.contact.create({
        data: {
          userId,
          phone: c.phone.replace(/\D/g, ''),
          name: c.name || null,
          tags: JSON.stringify(c.tags || []),
        },
      })
    )
  );

  return NextResponse.json({ created, count: created.length }, { status: 201 });
}