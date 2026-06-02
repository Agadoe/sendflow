import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { randomBytes } from 'crypto';

const KEY_CACHE = new Map<string, string>(); // hash -> userId

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function validateKey(rawKey: string): Promise<string | null> {
  if (!rawKey) return null;
  const h = hashKey(rawKey);
  const cached = KEY_CACHE.get(h);
  if (cached) return cached;

  const dbKey = await prisma.apiKey.findFirst({
    where: { key: rawKey },
    select: { userId: true },
  });
  if (!dbKey) return null;

  KEY_CACHE.set(h, dbKey.userId);
  return dbKey.userId;
}

// POST /api/leads/ingest — batch create leads from LEADOPS agents
// Auth: X-SENDFLOW-KEY header
export async function POST(req: NextRequest) {
  const rawKey = req.headers.get('x-sendflow-key') || '';
  const userId = await validateKey(rawKey);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  try {
    const { leads } = await req.json();
    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'leads array required' }, { status: 400 });
    }

    if (leads.length > 500) {
      return NextResponse.json({ error: 'Max 500 leads per batch' }, { status: 400 });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const lead of leads) {
      try {
        if (!lead.name && !lead.email && !lead.phone) {
          results.skipped++;
          continue;
        }

        // Upsert by email if provided
        if (lead.email) {
          const existing = await prisma.lead.findFirst({
            where: { userId, email: lead.email },
          });
          if (existing) {
            // Update stage if provided
            if (lead.stage) {
              await prisma.lead.update({
                where: { id: existing.id },
                data: { stage: lead.stage, updatedAt: new Date() },
              });
            }
            results.skipped++;
            continue;
          }
        }

        const newLead = await prisma.lead.create({
          data: {
            userId,
            name: lead.name || 'Unknown',
            email: lead.email || null,
            phone: lead.phone || null,
            company: lead.company || null,
            stage: lead.stage || 'NEW',
            source: lead.source || 'LEADOPS',
            notes: lead.notes || '',
            nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp) : null,
          },
        });

        if (lead.notes || lead.activity) {
          await prisma.leadActivity.create({
            data: {
              leadId: newLead.id,
              userId,
              type: 'note',
              content: lead.activity || `Lead ingested via LEADOPS — source: ${lead.source || 'unknown'}`,
            },
          });
        }

        results.created++;
      } catch (err) {
        results.errors.push(`Failed to create lead ${lead.email || lead.phone}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Update lastUsed on the API key
    await prisma.apiKey.updateMany({
      where: { key: rawKey },
      data: { lastUsed: new Date() },
    });

    return NextResponse.json({
      success: true,
      results,
      ingestedAt: new Date().toISOString(),
    }, { status: 201 });

  } catch (err) {
    console.error('Lead ingest error:', err);
    return NextResponse.json({ error: 'Batch ingest failed' }, { status: 500 });
  }
}

// GET /api/lead-push — check API key validity and account info
export async function GET(req: NextRequest) {
  const rawKey = req.headers.get('x-sendflow-key') || '';
  const userId = await validateKey(rawKey);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, plan: true },
  });

  const leadCount = await prisma.lead.count({ where: { userId } });

  return NextResponse.json({
    status: 'ok',
    user,
    leadCount,
  });
}