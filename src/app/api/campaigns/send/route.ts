import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://127.0.0.1:4555';

function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

async function sendViaDaemon(phone: string, message: string): Promise<void> {
  const res = await fetch(`${DAEMON_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Daemon returned ${res.status}`);
  }
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = cookieHeader ? cookieHeader.match(/sf_token=([^;]+)/)?.[1] : null;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId, userId },
    include: { messages: { include: { contact: true }, where: { status: 'PENDING' } } },
  });

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Mark in-progress before starting (so we can recover if crash)
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', sentAt: new Date() },
  });

  let sent = 0, failed = 0;

  for (const msg of campaign.messages) {
    try {
      const formatted = formatPhone(msg.contact.phone);
      await sendViaDaemon(formatted, campaign.content);
      await prisma.message.update({ where: { id: msg.id }, data: { status: 'SENT', sentAt: new Date() } });
      sent++;
    } catch (e: any) {
      await prisma.message.update({ where: { id: msg.id }, data: { status: 'FAILED', failureReason: e.message } });
      failed++;
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: sent > 0 ? 'SENT' : 'FAILED' },
  });

  return NextResponse.json({ sent, failed, total: campaign.messages.length });
}