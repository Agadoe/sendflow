import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { getSession } from '@/lib/auth';
import { requirePlan } from '@/lib/plans';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131/wacli';

// KEY_CACHE with TTL — entries expire after 5 minutes to prevent unbounded growth
const KEY_CACHE = new Map<string, { userId: string; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 5 * 60 * 1000;

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function cleanKeyCache() {
  const now = Date.now();
  KEY_CACHE.forEach((v, k) => { if (v.expiresAt < now) KEY_CACHE.delete(k); });
}

async function validateKey(rawKey: string): Promise<{ userId: string; plan: string } | null> {
  if (!rawKey) return null;
  cleanKeyCache();
  const h = hashKey(rawKey);
  const cached = KEY_CACHE.get(h);
  if (cached && cached.expiresAt > Date.now()) return { userId: cached.userId, plan: 'FREE' };
  const dbKey = await prisma.apiKey.findFirst({
    where: { key: rawKey },
    select: { userId: true, user: { select: { plan: true } } },
  });
  if (!dbKey) return null;
  const plan = dbKey.user?.plan ?? 'FREE';
  KEY_CACHE.set(h, { userId: dbKey.userId, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
  return { userId: dbKey.userId, plan };
}

function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

async function sendViaDaemon(phone: string, message: string): Promise<void> {
  const res = await fetch(`${DAEMON_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Daemon returned ${res.status}`);
  }
}

export async function POST(req: Request) {
  const request = req as NextRequest;
  const rawKey = request.headers.get('x-sendflow-key');
  let userId: string | null = null;
  let userPlan: string = 'FREE';

  // Try API key first (includes plan), fall back to session
  if (rawKey) {
    const keyResult = await validateKey(rawKey);
    if (keyResult) { userId = keyResult.userId; userPlan = keyResult.plan; }
  }
  if (!userId) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = session.id;
    userPlan = session.plan;
  }

  // Plan gate — bulk send is a paid feature
  try {
    requirePlan(userPlan, 'bulkSend');
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }

  try {
    const { name, content, tags, contactIds } = await req.json();
    if (!name || !content) {
      return NextResponse.json({ error: 'name and content required' }, { status: 400 });
    }

    // Find contacts by tags or IDs
    let contacts: { id: string; phone: string; name: string | null }[] = [];
    if (contactIds && contactIds.length > 0) {
      contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds }, userId },
        select: { id: true, phone: true, name: true },
      });
    } else if (tags && tags.length > 0) {
      const allContacts = await prisma.contact.findMany({
        where: { userId },
        select: { id: true, phone: true, name: true, tags: true },
      });
      contacts = allContacts.filter(c => {
        try {
          const t = JSON.parse(c.tags || '[]');
          return tags.some((tag: string) => t.includes(tag));
        } catch { return false; }
      });
    }

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found' }, { status: 400 });
    }

    const totalContacts = contacts.length;

    // Create campaign with PENDING status first (not SENDING — we'll update after sends)
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        name,
        content,
        status: 'PENDING',
        sentAt: new Date(),
      },
    });

    // Send messages — one by one via daemon
    let sent = 0, failed = 0, invalid = 0;
    const errors: string[] = [];

    for (const c of contacts) {
      const phone = (c.phone || '').replace(/\D/g, '');
      if (phone.length < 9) { invalid++; continue; }

      try {
        const formatted = formatPhone(phone);
        await sendViaDaemon(formatted, content);
        await prisma.message.create({
          data: { campaignId: campaign.id, contactId: c.id, status: 'SENT', sentAt: new Date() },
        });
        sent++;
      } catch (e: any) {
        // Check if a PENDING message already exists (from prior failed attempt), else create FAILED
        const existing = await prisma.message.findFirst({
          where: { campaignId: campaign.id, contactId: c.id },
        });
        if (existing) {
          await prisma.message.update({ where: { id: existing.id }, data: { status: 'FAILED', failureReason: e.message } });
        } else {
          await prisma.message.create({
            data: { campaignId: campaign.id, contactId: c.id, status: 'FAILED', failureReason: e.message },
          });
        }
        failed++;
        errors.push(`${c.phone}: ${e.message}`);
      }
    }

    // Final status — only SENT if at least some succeeded, else FAILED
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: sent > 0 ? 'SENT' : 'FAILED' },
    });

    return NextResponse.json({
      campaignId: campaign.id,
      sent,
      failed,
      invalid,
      total: totalContacts,
      errors: errors.slice(0, 10), // first 10 errors for debugging
    });
  } catch (err: any) {
    console.error('Bulk send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}