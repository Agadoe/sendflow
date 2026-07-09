import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

const VALID_NAME = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;
const VALID_TAG = /^[a-z0-9][a-z0-9-_]{0,62}[a-z0-9]$/;

/**
 * GET /api/segments — list all segments for the current user with live counts.
 *
 * Count is computed by scanning Contact.tags (JSON array string) for the
 * segment's tag. For users with <50k contacts this is fast (single query,
 * in-memory filter). If the count ever becomes a hot path, we can add a
 * denormalized counter later.
 */
export async function GET(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const [segments, contacts] = await Promise.all([
    prisma.segment.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    }),
    prisma.contact.findMany({
      where: { userId },
      select: { tags: true },
    }),
  ]);

  // Build per-tag count map
  const tagCounts = new Map<string, number>();
  for (const c of contacts) {
    try {
      const tags: string[] = JSON.parse(c.tags || '[]');
      for (const t of tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    } catch {}
  }

  // For each segment, sum counts for contacts matching the segment's tag.
  // v1 = single tag per segment, so the count is just tagCounts.get(segment.tag).
  // Reserved for v2: when matchType === 'ALL', intersect tag sets instead of summing.
  const enriched = segments.map((s) => ({
    ...s,
    contactCount: tagCounts.get(s.tag) || 0,
  }));

  return NextResponse.json({ segments: enriched });
}

/**
 * POST /api/segments — create a new segment.
 * Body: { name, tag, color?, description? }
 *
 * Validation:
 * - name: lowercase kebab-case, 2-64 chars, unique per user
 * - tag: lowercase kebab/snake, 2-64 chars
 * - color: optional, must be hex like #RRGGBB
 */
export async function POST(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, tag, color, description } = body;
  if (!name || !tag) {
    return NextResponse.json({ error: 'name and tag are required' }, { status: 400 });
  }
  if (!VALID_NAME.test(name)) {
    return NextResponse.json(
      { error: 'name must be lowercase kebab-case (2-64 chars, start/end alphanumeric)' },
      { status: 400 }
    );
  }
  if (!VALID_TAG.test(tag)) {
    return NextResponse.json(
      { error: 'tag must be lowercase alphanumeric with hyphens/underscores (2-64 chars)' },
      { status: 400 }
    );
  }
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return NextResponse.json({ error: 'color must be a hex like #RRGGBB' }, { status: 400 });
  }
  if (description && description.length > 280) {
    return NextResponse.json({ error: 'description must be 280 chars or fewer' }, { status: 400 });
  }

  // Enforce plan-level segment cap.
  // FREE: 5 segments, paid: 100. Prevents tag explosion.
  const plan = (session.plan || 'FREE').toUpperCase();
  const cap = plan === 'FREE' ? 5 : 100;
  const existingCount = await prisma.segment.count({ where: { userId } });
  if (existingCount >= cap) {
    return NextResponse.json(
      {
        error: `Segment limit reached (${cap}). ${plan === 'FREE' ? 'Upgrade to create more.' : 'Contact support.'}`,
        code: 'SEGMENT_LIMIT_EXCEEDED',
      },
      { status: 403 }
    );
  }

  try {
    const segment = await prisma.segment.create({
      data: {
        userId,
        name,
        tag,
        color: color || null,
        description: description || null,
        matchType: 'ANY',
      },
    });
    return NextResponse.json({ segment: { ...segment, contactCount: 0 } }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'A segment with that name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 });
  }
}
