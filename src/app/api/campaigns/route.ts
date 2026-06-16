import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkCampaignLimit, PLANS, type PlanCode } from '@/lib/plans';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

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

  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { name, content, mediaUrl, scheduledAt, recurrence, contactIds } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: 'Name and content required' }, { status: 400 });
  }

  // Enforce monthly campaign limit
  const canCreate = await checkCampaignLimit(userId, prisma);
  if (!canCreate) {
    const plan = session.plan;
    const max = PLANS[plan as PlanCode]?.maxCampaignsPerMonth ?? 0;
    return NextResponse.json({
      error: `Monthly campaign limit reached. Your ${plan} plan allows ${max} campaigns per month.`,
      code: 'CAMPAIGN_LIMIT_EXCEEDED',
    }, { status: 403 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId,
      name,
      content,
      mediaUrl: mediaUrl || null,
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      recurrence: recurrence || null,
    },
  });

  if (contactIds && contactIds.length > 0) {
    const messageRecords = contactIds.map((contactId: string) => ({
      campaignId: campaign.id,
      contactId,
      status: 'PENDING',
    }));
    await prisma.message.createMany({ data: messageRecords });
  }

  return NextResponse.json({ campaign }, { status: 201 });
}
