import { getJWTSecret } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';


async function auth(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    if (payload.role !== 'CLIENT') return null;
    return payload.sub as string;
  } catch { return null; }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await auth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, userId } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const activities = await prisma.leadActivity.findMany({
    where: { leadId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const outboundMessages = await prisma.outboundMessage.findMany({
    where: { leadId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ activities, outboundMessages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await auth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, userId } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { type, content, metadata } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 400 });

  const validTypes = ['note', 'call', 'email', 'whatsapp', 'stage_change', 'score_update', 'enrichment', 'sms', 'telegram'];
  const activityType = validTypes.includes(type) ? type : 'note';

  const activity = await prisma.leadActivity.create({
    data: {
      leadId: id,
      userId,
      type: activityType,
      content: content.trim(),
      metadata: JSON.stringify(metadata || {}),
    },
  });

  // Update lead lastContactedAt on outbound activity types
  const outboundTypes = ['call', 'email', 'whatsapp', 'sms', 'telegram'];
  if (outboundTypes.includes(activityType)) {
    await prisma.lead.update({
      where: { id },
      data: {
        lastContactedAt: new Date(),
        contactCount: { increment: 1 },
      },
    });
  }

  return NextResponse.json({ activity }, { status: 201 });
}