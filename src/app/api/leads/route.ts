import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getSession(req as NextRequest);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage');

    const leads = await prisma.lead.findMany({
      where: {
        userId: session.id,
        ...(stage && { stage }),
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { activities: true } } },
    });

    return NextResponse.json({ leads });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req as NextRequest);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, phone, company, source, notes } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        userId: session.id,
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        source: source || 'other',
        notes: notes || '',
        stage: 'NEW',
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        userId: session.id,
        type: 'note',
        content: `Lead created via ${source || 'manual'} source.`,
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
