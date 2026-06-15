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

/**
 * POST — log an outbound message sent by n8n/SendFlow.
 * Called by the n8n workflow after sending via wacli.
 * Body: { leadId, channel, content, externalId, metadata }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await auth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, userId } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { channel, content, externalId, metadata } = await req.json();
  if (!channel || !content) {
    return NextResponse.json({ error: 'channel and content are required' }, { status: 400 });
  }

  const validChannels = ['whatsapp', 'email', 'sms', 'telegram'];
  if (!validChannels.includes(channel)) {
    return NextResponse.json({ error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` }, { status: 400 });
  }

  const [outboundMsg, updatedLead] = await prisma.$transaction([
    prisma.outboundMessage.create({
      data: {
        leadId: id,
        userId,
        channel,
        content,
        status: 'SENT',
        sentAt: new Date(),
        externalId: externalId || null,
        metadata: JSON.stringify(metadata || {}),
      },
    }),
    prisma.lead.update({
      where: { id },
      data: {
        outreachStatus: 'SENT',
        lastOutreachAt: new Date(),
        contactCount: { increment: 1 },
        lastContactedAt: new Date(),
      },
    }),
  ]);

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      userId,
      type: channel as string,
      content: `Outbound ${channel} sent: ${(content as string).slice(0, 80)}${(content as string).length > 80 ? '…' : ''}`,
      metadata: JSON.stringify({ outboundId: outboundMsg.id, channel }),
    },
  });

  return NextResponse.json({ outboundMessage: outboundMsg, lead: updatedLead }, { status: 201 });
}

/**
 * PATCH — update message delivery/read status.
 * Called by n8n webhook when WhatsApp confirms delivery.
 * Body: { status: 'DELIVERED' | 'READ' | 'REPLIED' | 'FAILED', failureReason? }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await auth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { status, failureReason, externalId } = await req.json();

  const validStatuses = ['PENDING', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED', 'BOUNCED'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Find the most recent message for this lead if no externalId provided
  const whereClause = externalId ? { externalId } : { leadId: id };
  const existing = await prisma.outboundMessage.findFirst({
    where: { ...whereClause, userId },
    orderBy: { createdAt: 'desc' },
  });
  if (!existing) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  const updateData: Record<string, unknown> = { status };
  if (status === 'DELIVERED') updateData.deliveredAt = new Date();
  if (status === 'READ')      updateData.readAt      = new Date();
  if (status === 'REPLIED')   updateData.repliedAt   = new Date();
  if (status === 'FAILED')    updateData.failureReason = failureReason || null;

  const updated = await prisma.outboundMessage.update({
    where: { id: existing.id },
    data: updateData,
  });

  // If replied → update lead outreachStatus
  if (status === 'REPLIED') {
    await prisma.lead.update({
      where: { id },
      data: { outreachStatus: 'REPLIED' },
    });
  }

  return NextResponse.json({ outboundMessage: updated });
}