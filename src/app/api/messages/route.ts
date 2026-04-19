import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const messages = await prisma.message.findMany({
    where: { campaignId },
    include: { contact: { select: { name: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ messages });
}