import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

// POST /api/contacts/[id]/tags — add/remove tags and trigger automations
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { action, tag } = await req.json(); // action: 'add' | 'remove'

  if (!tag || !action) return NextResponse.json({ error: 'tag and action required' }, { status: 400 });

  const contact = await prisma.contact.findFirst({ where: { id, userId } });
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  let tags: string[] = [];
  try { tags = JSON.parse(contact.tags || '[]'); } catch {}

  if (action === 'add' && !tags.includes(tag)) {
    tags.push(tag);
  } else if (action === 'remove') {
    tags = tags.filter(t => t !== tag);
  }

  await prisma.contact.update({ where: { id }, data: { tags: JSON.stringify(tags) } });

  // Trigger automations for tag_applied
  if (action === 'add') {
    await triggerTagAutomations(userId, contact, tag);
  }

  return NextResponse.json({ success: true, tags });
}

async function triggerTagAutomations(userId: string, contact: any, tag: string) {
  const automations = await prisma.automation.findMany({
    where: { userId, isEnabled: true, trigger: 'tag_applied' },
  });

  for (const automation of automations) {
    let config: any = {};
    try { config = JSON.parse(automation.triggerConfig || '{}'); } catch {}

    // Check if this tag matches the automation's target tag
    if (config.targetTag && config.targetTag !== tag) continue;

    await scheduleDripFromAutomation(automation, contact);
  }
}

async function scheduleDripFromAutomation(automation: any, contact: any) {
  let actions: any[] = [];
  try { actions = JSON.parse(automation.actions || '[]'); } catch {}
  actions.sort((a: any, b: any) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  for (const action of actions) {
    const delayMs = (action.delayMinutes || 0) * 60 * 1000;
    const scheduledFor = new Date(Date.now() + delayMs);

    await prisma.dripScheduledMessage.create({
      data: {
        userId: contact.userId,
        contactId: contact.id,
        automationId: automation.id,
        channel: action.channel || 'whatsapp',
        template: action.template || '',
        scheduledFor,
        sequenceOrder: action.sequenceOrder || 0,
        status: 'PENDING',
      },
    });
  }

  await prisma.automation.update({
    where: { id: automation.id },
    data: { lastTriggered: new Date() },
  });

  await prisma.automationExecution.create({
    data: {
      automationId: automation.id,
      contactId: contact.id,
      event: 'triggered',
      payload: JSON.stringify({ trigger: 'tag_applied' }),
    },
  });
}