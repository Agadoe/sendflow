import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { name, email, phone, businessType } = await req.json();
    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
    }

    const entry = await prisma.waitlist.upsert({
      where: { email },
      update: { name, phone, businessType },
      create: { email, name, phone, businessType },
    });

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const entries = await prisma.waitlist.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ count: entries.length, entries });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
  }
}
