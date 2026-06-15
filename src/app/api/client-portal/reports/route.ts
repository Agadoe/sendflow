import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;

    if (payload.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Total messages sent by this user
    const totalMessages = await prisma.message.count({
      where: { campaign: { userId } },
    });

    // Delivered
    const deliveredMessages = await prisma.message.count({
      where: { campaign: { userId }, status: 'DELIVERED' },
    });

    // Read (status READ implies DELIVERED)
    const readMessages = await prisma.message.count({
      where: { campaign: { userId }, status: 'READ' },
    });

    // Last 7 days: group messages by date
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentMessages = await prisma.message.findMany({
      where: {
        campaign: { userId },
        sentAt: { gte: sevenDaysAgo },
      },
      select: { sentAt: true, status: true },
    });

    // Group by day
    const byDay: Record<string, { sent: number; delivered: number; read: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      byDay[key] = { sent: 0, delivered: 0, read: 0 };
    }

    for (const msg of recentMessages) {
      if (!msg.sentAt) continue;
      const key = msg.sentAt.toISOString().split('T')[0];
      if (byDay[key]) {
        byDay[key].sent += 1;
        if (msg.status === 'DELIVERED' || msg.status === 'READ') byDay[key].delivered += 1;
        if (msg.status === 'READ') byDay[key].read += 1;
      }
    }

    const chartData = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        ...counts,
      }));

    const deliveredRate = totalMessages > 0 ? Math.round((deliveredMessages / totalMessages) * 100) : 0;
    const readRate = totalMessages > 0 ? Math.round((readMessages / totalMessages) * 100) : 0;

    return NextResponse.json({
      stats: {
        totalMessages,
        deliveredMessages,
        deliveredRate,
        readMessages,
        readRate,
      },
      chartData,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}