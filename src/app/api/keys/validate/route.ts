import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

// KEY_STORE with TTL — entries expire after 1 hour to prevent unbounded growth
const KEY_STORE = new Map<string, { userId: string; name: string; expiresAt: number }>();
const KEY_TTL_MS = 60 * 60 * 1000;

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function cleanStore() {
  const now = Date.now();
  KEY_STORE.forEach((v, k) => { if (v.expiresAt < now) KEY_STORE.delete(k); });
}

// POST /api/keys/validate — register a key in memory + DB
export async function POST(req: NextRequest) {
  try {
    const { key, userId } = await req.json();
    if (!key || !userId) {
      return NextResponse.json({ error: 'key and userId required' }, { status: 400 });
    }

    const h = hashKey(key);
    KEY_STORE.set(h, { userId, name: 'LEADOPS', expiresAt: Date.now() + KEY_TTL_MS });

    const existing = await prisma.apiKey.findFirst({ where: { key, userId } });
    if (!existing) {
      await prisma.apiKey.create({ data: { userId, key } });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to register key' }, { status: 500 });
  }
}

// GET /api/keys/validate — validate a raw key and return userId
export async function GET(req: NextRequest) {
  const rawKey = req.headers.get('x-sendflow-key');
  if (!rawKey) return NextResponse.json({ error: 'x-sendflow-key header required' }, { status: 401 });

  try {
    cleanStore();
    const h = hashKey(rawKey);
    const record = KEY_STORE.get(h);
    if (record && record.expiresAt > Date.now()) return NextResponse.json({ userId: record.userId });

    // Fallback: check DB
    const dbKey = await prisma.apiKey.findFirst({
      where: { key: rawKey },
      select: { userId: true },
    });
    if (!dbKey) return NextResponse.json({ error: 'Invalid key' }, { status: 401 });

    // Refresh TTL in memory
    KEY_STORE.set(h, { userId: dbKey.userId, name: 'LEADOPS', expiresAt: Date.now() + KEY_TTL_MS });

    return NextResponse.json({ userId: dbKey.userId });
  } catch (e) {
    return NextResponse.json({ error: 'Key validation failed' }, { status: 500 });
  }
}