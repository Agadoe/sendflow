import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;

    if (payload.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leads = await prisma.lead.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ leads });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}