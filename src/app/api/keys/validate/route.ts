import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';

// Simple in-memory key store for validation (keys stored as sha256 hashes)
// The raw key is returned once on creation, then only the hash is stored
const KEY_STORE = new Map<string, { userId: string; name: string }>();

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function getKeyRecord(rawKey: string) {
  // Check in-memory store first (populated on first use via /api/keys)
  // Fall back to DB lookup by hash
  const h = hashKey(rawKey);
  const record = KEY_STORE.get(h);
  if (record) return record;
  // Try DB by stored key (raw for simplicity)
  return null;
}

// POST /api/keys/validate — one-time call to register a key in memory
export async function POST(req: NextRequest) {
  try {
    const { key, userId } = await req.json();
    if (!key || !userId) {
      return NextResponse.json({ error: 'key and userId required' }, { status: 400 });
    }

    const h = hashKey(key);
    KEY_STORE.set(h, { userId, name: 'LEADOPS' });

    // Also ensure DB record exists
    const existing = await prisma.apiKey.findFirst({
      where: { key, userId },
    });
    if (!existing) {
      await prisma.apiKey.create({
        data: { userId, key },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to register key' }, { status: 500 });
  }
}

// Validate a raw key and return userId
export async function GET(req: NextRequest) {
  const rawKey = req.headers.get('x-sendflow-key');
  if (!rawKey) {
    return NextResponse.json({ error: 'x-sendflow-key header required' }, { status: 401 });
  }

  try {
    const h = hashKey(rawKey);
    const record = KEY_STORE.get(h);
    if (record) return NextResponse.json({ userId: record.userId });

    // Fallback: check DB
    const dbKey = await prisma.apiKey.findFirst({
      where: { key: rawKey },
      include: { user: { select: { id: true } } },
    });
    if (!dbKey) return NextResponse.json({ error: 'Invalid key' }, { status: 401 });

    // Cache in memory
    KEY_STORE.set(h, { userId: dbKey.userId, name: 'LEADOPS' });

    return NextResponse.json({ userId: dbKey.userId });
  } catch (e) {
    return NextResponse.json({ error: 'Key validation failed' }, { status: 500 });
  }
}