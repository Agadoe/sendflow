import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const automations = await prisma.automation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ automations });
}

export async function POST(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const body = await req.json();
  const { name, description, trigger, triggerConfig, conditions, actions } = body;

  if (!name || !trigger) {
    return NextResponse.json({ error: 'name and trigger are required' }, { status: 400 });
  }

  const automation = await prisma.automation.create({
    data: {
      userId,
      name,
      description: description || null,
      trigger,
      triggerConfig: JSON.stringify(triggerConfig || {}),
      conditions: JSON.stringify(conditions || []),
      actions: JSON.stringify(actions || []),
    },
  });

  return NextResponse.json({ automation }, { status: 201 });
}
