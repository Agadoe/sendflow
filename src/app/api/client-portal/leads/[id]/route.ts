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
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await auth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, userId },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      _count: { select: { activities: true } },
    },
  });

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Parse JSON fields
  const parsed = {
    ...lead,
    notes: JSON.parse(lead.notes || '[]'),
    tags:  JSON.parse(lead.tags  || '[]'),
    scoreBreakdown: JSON.parse(lead.scoreBreakdown || '{}'),
  };

  return NextResponse.json({ lead: parsed });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await auth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.lead.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const body = await req.json();
  const {
    name, email, phone, company, stage, notes, tags,
    nextFollowUp, dealValue, score, scoreBreakdown,
    contactCount, lastContactedAt, outreachStatus,
    jobTitle, industry, linkedinUrl, website, address,
    icpBusinessType, icpTargetCustomer,
  } = body;

  // Track stage change
  const changes: string[] = [];
  if (stage && stage !== existing.stage) {
    changes.push(`Stage changed: ${existing.stage} → ${stage}`);
  }
  if (outreachStatus && outreachStatus !== existing.outreachStatus) {
    changes.push(`Outreach status: ${existing.outreachStatus} → ${outreachStatus}`);
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(name             !== undefined && { name: name.trim() }),
      ...(email           !== undefined && { email: email?.trim() || null }),
      ...(phone           !== undefined && { phone: phone?.trim() || null }),
      ...(company         !== undefined && { company: company?.trim() || null }),
      ...(stage           !== undefined && { stage }),
      ...(notes           !== undefined && { notes: JSON.stringify(notes) }),
      ...(tags            !== undefined && { tags:  JSON.stringify(tags) }),
      ...(nextFollowUp    !== undefined && { nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null }),
      ...(dealValue       !== undefined && { dealValue: dealValue ? Number(dealValue) : null }),
      ...(score           !== undefined && { score: Number(score) }),
      ...(scoreBreakdown  !== undefined && { scoreBreakdown: JSON.stringify(scoreBreakdown) }),
      ...(contactCount    !== undefined && { contactCount: Number(contactCount) }),
      ...(lastContactedAt !== undefined && { lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : null }),
      ...(outreachStatus  !== undefined && { outreachStatus }),
      ...(jobTitle        !== undefined && { jobTitle }),
      ...(industry        !== undefined && { industry }),
      ...(linkedinUrl     !== undefined && { linkedinUrl }),
      ...(website         !== undefined && { website }),
      ...(address         !== undefined && { address }),
      ...(icpBusinessType     !== undefined && { icpBusinessType }),
      ...(icpTargetCustomer   !== undefined && { icpTargetCustomer }),
      ...(stage === 'CONVERTED' && { convertedAt: new Date() }),
    },
  });

  // Log changes as activities
  if (changes.length > 0) {
    await prisma.leadActivity.createMany({
      data: changes.map(content => ({
        leadId: id,
        userId,
        type: 'stage_change',
        content,
        metadata: '{}',
      })),
    });
  }

  return NextResponse.json({
    lead: {
      ...updated,
      notes: JSON.parse(updated.notes || '[]'),
      tags:  JSON.parse(updated.tags  || '[]'),
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await auth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.lead.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}