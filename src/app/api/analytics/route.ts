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

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    include: { _count: { select: { messages: true } }, messages: true },
  });

  const total = campaigns.reduce((acc, c) => acc + (c._count?.messages || 0), 0);
  const delivered = campaigns.reduce((acc, c) => acc + c.messages.filter((m: any) => m.status === 'DELIVERED').length, 0);
  const failed = campaigns.reduce((acc, c) => acc + c.messages.filter((m: any) => m.status === 'FAILED').length, 0);

  const stats = {
    total,
    delivered,
    failed,
    rate: total > 0 ? Math.round((delivered / total) * 100) : 0,
  };

  const campaignStats = campaigns.map((c: any) => {
    const sent = c.messages.length;
    const d = c.messages.filter((m: any) => m.status === 'DELIVERED').length;
    const f = c.messages.filter((m: any) => m.status === 'FAILED').length;
    return {
      id: c.id,
      name: c.name,
      sent,
      delivered: d,
      failed: f,
      rate: sent > 0 ? Math.round((d / sent) * 100) : 0,
    };
  });

  // Email stats from Mailchimp
  const email = { sent: 0, openRate: 0, clickRate: 0 };
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const dc = process.env.MAILCHIMP_DC;
  if (apiKey && dc) {
    try {
      const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
      const authHeader = 'Basic ' + Buffer.from(`anystring:${apiKey}`).toString('base64');
      const res = await fetch(`${baseUrl}/campaigns?count=20&sort_field=send_time&sort_dir=DESC`, {
        headers: { 'Authorization': authHeader },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.campaigns) {
        email.sent = data.campaigns.reduce((acc: number, c: any) => acc + (c.emails_sent || 0), 0);
        const withOpen = data.campaigns.filter((c: any) => c.report_summary?.open_rate);
        if (withOpen.length) {
          email.openRate = Math.round(withOpen.reduce((acc: number, c: any) => acc + c.report_summary.open_rate * 100, 0) / withOpen.length);
        }
        const withClicks = data.campaigns.filter((c: any) => c.report_summary?.click_rate);
        if (withClicks.length) {
          email.clickRate = Math.round(withClicks.reduce((acc: number, c: any) => acc + c.report_summary.click_rate * 100, 0) / withClicks.length);
        }
      }
    } catch {}
  }

  // SMS stats placeholder (Termii doesn't have a simple list endpoint without a plan)
  const sms = { sent: 0, delivered: 0 };

  return NextResponse.json({ stats, campaigns: campaignStats, whatsapp: { sent: total, delivered, failed, campaigns: campaigns.length }, email, sms });
}
