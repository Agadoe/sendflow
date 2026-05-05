import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req as NextRequest);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { type, content } = await req.json();

    const validTypes = ['note', 'call', 'email', 'whatsapp', 'stage_change'];
    if (!validTypes.includes(type) || !content?.trim()) {
      return NextResponse.json({ error: 'type and content are required' }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({ where: { id, userId: session.id } });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const activity = await prisma.leadActivity.create({
      data: { leadId: id, userId: session.id, type, content: content.trim() },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to add activity' }, { status: 500 });
  }
}
