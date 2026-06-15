import { JWT_SECRET } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';


export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const userId = payload.sub as string;

    const { searchParams } = new URL(req.url);
    const stage    = searchParams.get('stage');
    const search   = searchParams.get('search');
    const source   = searchParams.get('source');
    const minScore = Number(searchParams.get('minScore') || '0');
    const sortBy   = searchParams.get('sortBy') || 'updatedAt';
    const sortDir  = searchParams.get('sortDir') || 'desc';
    const page     = Number(searchParams.get('page') || '1');
    const limit    = Number(searchParams.get('limit') || '50');

    const where = {
      userId,
      ...(stage   && { stage }),
      ...(source  && { source: { contains: source } }),
      ...(minScore > 0 && { score: { gte: minScore } }),
      ...(search && {
        OR: [
          { name:     { contains: search } },
          { company:  { contains: search } },
          { email:    { contains: search } },
          { phone:    { contains: search } },
          { tags:     { contains: search } },
        ],
      }),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { activities: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    // Compute stage counts for filter pills
    const stageCounts = await prisma.lead.groupBy({
      by: ['stage'],
      where: { userId },
      _count: { stage: true },
    });

    return NextResponse.json({
      leads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stageCounts: Object.fromEntries(stageCounts.map(s => [s.stage, s._count.stage])),
    });
  } catch (err) {
    console.error('[leads:GET]', err);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const userId = payload.sub as string;

    const body = await req.json();
    const { name, email, phone, company, source, notes, stage, tags, dealValue, score } = body;

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const lead = await prisma.lead.create({
      data: {
        userId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        source: source?.trim() || 'manual',
        stage: stage || 'SCOUTED',
        notes: notes ? JSON.stringify(notes) : '[]',
        tags: tags ? JSON.stringify(tags) : '[]',
        dealValue: dealValue ? Number(dealValue) : null,
        score: score ? Number(score) : 0,
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        userId,
        type: 'note',
        content: `Lead created manually by client. Stage: ${lead.stage}.`,
        metadata: JSON.stringify({ createdFrom: 'client_portal' }),
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error('[leads:POST]', err);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}