import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { prisma } from '@/lib/prisma';

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

  // Update campaign status
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', sentAt: new Date() },
  });

  let sent = 0;
  let failed = 0;

  for (const msg of campaign.messages) {
    try {
      const contact = msg.contact;
      const phone = contact.phone.startsWith('0')
        ? `233${contact.phone.slice(1)}`
        : contact.phone;

      const cmd = `wacli send --phone ${phone} --message "${campaign.content.replace(/"/g, '\\"')}"`;
      execSync(cmd, { timeout: 15000 });

      await prisma.message.update({ where: { id: msg.id }, data: { status: 'SENT', sentAt: new Date() } });
      sent++;
    } catch {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'FAILED', failureReason: 'Send failed' },
      });
      failed++;
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: sent > 0 ? 'SENT' : 'FAILED' },
  });

  return NextResponse.json({ sent, failed, total: campaign.messages.length });
}