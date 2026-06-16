import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131/wacli';

function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

async function sendViaDaemon(userId: string, phone: string, message: string): Promise<void> {
  const res = await fetch(`${DAEMON_URL}/send`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Daemon returned ${res.status}`);
  }
}

export async function POST(req: Request) {
  // Get the current user
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId, userId: user.id },
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
      await sendViaDaemon(user.id, formatted, campaign.content);
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