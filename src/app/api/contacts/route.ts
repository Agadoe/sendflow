import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { PLANS, checkContactLimit } from '@/lib/plans';

const KEY_CACHE = new Map<string, string>();
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

function getPrisma() {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('libsql') || url.startsWith('http')) {
    const libsql = createClient({ url });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as any);
  }
  return prisma;
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function validateKey(rawKey: string): Promise<string | null> {
  if (!rawKey) return null;
  const h = hashKey(rawKey);
  const cached = KEY_CACHE.get(h);
  if (cached) return cached;
  const p = getPrisma();
  const dbKey = await p.apiKey.findFirst({ where: { key: rawKey }, select: { userId: true } });
  if (!dbKey) return null;
  KEY_CACHE.set(h, dbKey.userId);
  return dbKey.userId;
}

export async function POST(req: Request) {
  const request = req as NextRequest;
  const rawKey = request.headers.get('x-sendflow-key');
  let userId: string | null = null;

  // Try API key first, fall back to session
  if (rawKey) {
    userId = await validateKey(rawKey);
  }
  if (!userId) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = session.id;
  }

  try {
    const { contacts } = await req.json();
    if (!Array.isArray(contacts)) {
      return NextResponse.json({ error: 'contacts array required' }, { status: 400 });
    }

    const overage = await checkContactLimit(userId!, contacts.length, prisma);
    if (overage > 0) {
      const plan = (await prisma.user.findUnique({ where: { id: userId! }, select: { plan: true } }))?.plan ?? 'FREE';
      const max = PLANS[plan as keyof typeof PLANS]?.maxContacts ?? 100;
      return NextResponse.json({
        error: `Contact limit reached. Your ${plan} plan allows ${max} contacts. This import would add ${overage} over the limit.`,
        code: 'CONTACT_LIMIT_EXCEEDED',
        current: max,
        overage,
      }, { status: 403 });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };
    for (const c of contacts) {
      try {
        const phone = (c.phone || '').replace(/\D/g, '');
        if (phone.length < 9) {
          results.errors.push(`Invalid phone: ${c.phone}`);
          continue;
        }
        // Check if contact exists
        const existing = await prisma.contact.findFirst({ where: { userId, phone } });
        if (existing) { results.skipped++; continue; }
        await prisma.contact.create({
          data: {
            userId,
            phone,
            name: c.name || null,
            tags: JSON.stringify(Array.isArray(c.tags) ? c.tags : []),
            optedIn: c.optedIn === true,
            optedInAt: c.optedIn === true ? new Date() : null,
            optedInSource: c.optedIn === true ? (c.optedInSource || 'manual-import') : null,
          },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`${c.phone}: ${e.message}`);
      }
    }
    return NextResponse.json(results, { status: 201 });
  } catch (err: any) {
    console.error('Contacts POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const request = req as NextRequest;
  const rawKey = request.headers.get('x-sendflow-key');
  let userId: string | null = null;

  if (rawKey) {
    userId = await validateKey(rawKey);
  }
  if (!userId) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = session.id;
  }

  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ contacts });
}
