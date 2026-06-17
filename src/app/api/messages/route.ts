import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  // Verify the campaign belongs to the authenticated user
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId: session.id },
  });
  if (!campaign) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const messages = await prisma.message.findMany({
    where: { campaignId },
    include: { contact: { select: { name: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ messages });
}