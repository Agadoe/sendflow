import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';


export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    const userId = payload.sub as string;

    if (payload.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });

    return NextResponse.json({ campaigns });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}