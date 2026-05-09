import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export async function POST(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { contacts } = await req.json();
    if (!Array.isArray(contacts)) {
      return NextResponse.json({ error: 'contacts array required' }, { status: 400 });
    }

    const results = { created: 0, errors: [] as string[] };
    for (const c of contacts) {
      try {
        const phone = (c.phone || '').replace(/\D/g, '');
        if (phone.length < 9) {
          results.errors.push(`Invalid phone: ${c.phone}`);
          continue;
        }
        await prisma.contact.create({
          data: {
            userId: session.id,
            phone,
            name: c.name || null,
            tags: JSON.stringify(c.tags || []),
          },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`${c.phone}: ${e.message}`);
      }
    }

    return NextResponse.json(results, { status: 201 });
  } catch (err: any) {
    console.error('Contacts POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contacts = await prisma.contact.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ contacts });
}