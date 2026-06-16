import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const keys = await prisma.apiKey.findMany({
      where: { userId: session.id },
      select: { id: true, name: true, key: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ keys });
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const { name } = await req.json();
    const keyName = name || 'API Key';

    const rawKey = `sf_${randomBytes(16).toString('hex')}`;
    const keyRecord = await prisma.apiKey.create({
      data: {
        userId: session.id,
        name: keyName,
        key: rawKey,
      },
    });

    return NextResponse.json({
      id: keyRecord.id,
      name: keyRecord.name,
      key: rawKey,
      createdAt: keyRecord.createdAt,
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.apiKey.deleteMany({
      where: { id, userId: session.id },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}