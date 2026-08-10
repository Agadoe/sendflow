import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkCampaignLimit, PLANS, type PlanCode } from '@/lib/plans';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

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

  const { name, content, mediaUrl, scheduledAt, recurrence, contactIds, segmentIds } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: 'Name and content required' }, { status: 400 });
  }
  if ((!contactIds || contactIds.length === 0) && (!segmentIds || segmentIds.length === 0)) {
    return NextResponse.json({ error: 'Provide contactIds or segmentIds' }, { status: 400 });
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

  // Two resolution paths (can be combined):
  // 1. contactIds provided → snapshot at create time. Message rows created now.
  // 2. segmentIds provided → resolve at SEND TIME. No Message rows now;
  //    the send route resolves fresh on each run (so newly-tagged contacts
  //    get the send even for scheduled campaigns).
  // Both can be provided together: segmentIds will be resolved at send time
  // and the union of {static contactIds + resolved segments} will be sent.
  if (segmentIds && segmentIds.length > 0) {
    // Verify segments belong to this user
    const segs = await prisma.segment.findMany({
      where: { id: { in: segmentIds }, userId },
      select: { id: true },
    });
    if (segs.length !== segmentIds.length) {
      // Roll back the campaign — we don't want orphaned records
      await prisma.campaign.delete({ where: { id: campaign.id } });
      return NextResponse.json({ error: 'One or more segments not found' }, { status: 404 });
    }
    // Persist the segmentIds on the campaign for later resolution.
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { segmentIds: JSON.stringify(segmentIds) },
    });
  }
  if (contactIds && contactIds.length > 0) {
    const messageRecords = contactIds.map((contactId: string) => ({
      campaignId: campaign.id,
      contactId,
      status: 'PENDING',
    }));
    await prisma.message.createMany({ data: messageRecords });
  }

  // Return the campaign with the segmentIds (parse JSON for the response)
  const final = await prisma.campaign.findUnique({
    where: { id: campaign.id },
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json({ campaign: final }, { status: 201 });
}
