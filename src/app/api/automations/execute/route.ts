import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

/**
 * Core execution engine.
 * Takes: { automationId, contactId, event }
 * Evaluates conditions, fires actions with delays.
 */
export async function POST(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { automationId, contactId, event } = await req.json();

  if (!automationId || !contactId) {
    return NextResponse.json({ error: 'automationId and contactId are required' }, { status: 400 });
  }

  const automation = await prisma.automation.findFirst({ where: { id: automationId, userId } });
  if (!automation) return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  if (!automation.isEnabled) return NextResponse.json({ error: 'Automation is disabled' }, { status: 400 });

  const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  // Parse conditions and evaluate
  let conditions: any[] = [];
  try { conditions = JSON.parse(automation.conditions); } catch { conditions = []; }

  for (const condition of conditions) {
    const { type, operator, value } = condition;
    if (type === 'tag') {
      let tags: string[] = [];
      try { tags = JSON.parse(contact.tags); } catch { tags = []; }
      if (operator === 'has' && !tags.includes(value)) return NextResponse.json({ executed: false, reason: 'tag condition failed' });
      if (operator === 'not_has' && tags.includes(value)) return NextResponse.json({ executed: false, reason: 'tag condition failed' });
    }
    // segment and channel conditions can be extended later
  }

  // Parse actions
  let actions: any[] = [];
  try { actions = JSON.parse(automation.actions); } catch { actions = []; }

  actions.sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  let actionsFired = 0;
  const now = new Date();

  // Create execution record
  await prisma.automationExecution.create({
    data: {
      automationId,
      contactId,
      event: 'triggered',
      payload: JSON.stringify({ event, source: 'execute_endpoint' }),
    },
  });

  for (const action of actions) {
    const delayMs = (action.delayMinutes || 0) * 60 * 1000;
    const fireAt = new Date(now.getTime() + delayMs);

    // In a real system, you would schedule these via a job queue.
    // For now, we log the action immediately and record it.
    await prisma.automationExecution.create({
      data: {
        automationId,
        contactId,
        event: 'action_sent',
        payload: JSON.stringify({
          channel: action.channel,
          template: action.template,
          delayMinutes: action.delayMinutes,
          sequenceOrder: action.sequenceOrder,
          scheduledFor: fireAt.toISOString(),
          triggeredEvent: event,
        }),
      },
    });

    actionsFired++;
  }

  // Mark automation as last triggered
  await prisma.automation.update({ where: { id: automationId }, data: { lastTriggered: now } });

  // Create completion record
  await prisma.automationExecution.create({
    data: {
      automationId,
      contactId,
      event: 'completed',
      payload: JSON.stringify({ actionsFired, event }),
    },
  });

  return NextResponse.json({ executed: true, actionsFired });
}
