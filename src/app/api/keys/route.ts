import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(req, 'ADMIN');
    const keys = await prisma.apiKey.findMany({
      where: { userId: session.id },
      select: { id: true, key: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ keys });
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(req, 'ADMIN');
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const rawKey = `sf_${randomBytes(16).toString('hex')}`;
    // Store first 8 chars as reference, hash for storage in production
    // For now store raw (replace with proper hash in production)
    const keyRecord = await prisma.apiKey.create({
      data: {
        userId: session.id,
        key: rawKey,
      },
    });

    return NextResponse.json({
      id: keyRecord.id,
      name,
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
    const session = await requireRole(req, 'ADMIN');
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