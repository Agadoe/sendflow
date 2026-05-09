import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import fs from 'fs';

const KEY_CACHE = new Map<string, string>();

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
  if (KEY_CACHE.has(h)) return KEY_CACHE.get(h)!;
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

  if (rawKey) {
    userId = await validateKey(rawKey);
  }
  if (!userId) {
    const cookieHeader = request.headers.get('cookie');
    const match = cookieHeader?.match(/sf_token=([^;]+)/);
    if (match) {
      try {
        const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
        userId = payload.sub || null;
      } catch { /* invalid token */ }
    }
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        name,
        content,
        status: 'SENDING',
        sentAt: new Date(),
      },
    });

    // Create messages and send
    let sent = 0, failed = 0, invalid = 0;
    for (const c of contacts) {
      const phone = (c.phone || '').replace(/\D/g, '');
      if (phone.length < 9) { invalid++; continue; }

      try {
        const formatted = phone.startsWith('233') ? phone : `233${phone}`;
        const msg = await prisma.message.create({
          data: { campaignId: campaign.id, contactId: c.id, status: 'PENDING' },
        });

        const escaped = content.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        execSync(`wacli send --phone +${formatted} --message "${escaped}"`, { timeout: 15000 });
        await prisma.message.update({ where: { id: msg.id }, data: { status: 'SENT', sentAt: new Date() } });
        sent++;
      } catch (e: any) {
        const msg = await prisma.message.findFirst({ where: { campaignId: campaign.id, contactId: c.id } });
        if (msg) await prisma.message.update({ where: { id: msg.id }, data: { status: 'FAILED', failureReason: e.message } });
        failed++;
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: sent > 0 ? 'SENT' : 'FAILED' },
    });

    return NextResponse.json({ campaignId: campaign.id, sent, failed, invalid, total: contacts.length });
  } catch (err: any) {
    console.error('Bulk send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}