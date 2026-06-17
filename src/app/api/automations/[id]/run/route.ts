import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { id } = await params;
  const automation = await prisma.automation.findFirst({ where: { id, userId } });
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { contactId } = await req.json();

  // If contactId provided, run for that contact; otherwise run for all contacts
  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    // Call execution engine
    const execRes = await fetch(new URL('/api/automations/execute', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cookie': req.headers.get('cookie') || '' },
      body: JSON.stringify({ automationId: id, contactId, event: 'manual' }),
    });
    const execData = await execRes.json();
    return NextResponse.json(execData);
  } else {
    // Run for all contacts
    const contacts = await prisma.contact.findMany({ where: { userId }, select: { id: true } });
    let fired = 0;
    for (const c of contacts) {
      try {
        await fetch(new URL('/api/automations/execute', req.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cookie': req.headers.get('cookie') || '' },
          body: JSON.stringify({ automationId: id, contactId: c.id, event: 'manual' }),
        });
        fired++;
      } catch { /* skip failures */ }
    }
    return NextResponse.json({ executed: true, contactsProcessed: fired, total: contacts.length });
  }
}
