import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

/**
 * POST /api/segments/resolve — resolve segment IDs to contact IDs.
 * Body: { segmentIds: string[] }
 *
 * Returns: { contactIds: string[], count: number, bySegment: { id, name, count }[] }
 *
 * v1 behavior (single-tag-per-segment):
 *   - For each segment, find all contacts whose tags JSON array contains the
 *     segment's tag.
 *   - Union all matching contactIds (dedup).
 *
 * Why this is a separate route:
 *   - The campaign modal previews the count as the user toggles segments.
 *   - The campaign create route needs to resolve segments to contacts
 *     AT SEND TIME (so newly-tagged contacts get a scheduled send).
 *   - The send route uses the same logic to build the actual Message rows.
 *
 * Limit: 50,000 resolved contacts per call. Larger lists should chunk.
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
  const { segmentIds } = body;
  if (!Array.isArray(segmentIds)) {
    return NextResponse.json({ error: 'segmentIds must be an array' }, { status: 400 });
  }
  if (segmentIds.length === 0) {
    return NextResponse.json({ contactIds: [], count: 0, bySegment: [] });
  }
  if (segmentIds.length > 50) {
    return NextResponse.json({ error: 'Too many segments (max 50)' }, { status: 400 });
  }

  // Verify all segments belong to this user (defense in depth).
  const segments = await prisma.segment.findMany({
    where: { id: { in: segmentIds }, userId },
    select: { id: true, name: true, tag: true },
  });
  if (segments.length !== segmentIds.length) {
    return NextResponse.json({ error: 'One or more segments not found' }, { status: 404 });
  }

  // Fetch all contacts for this user. For users with <50k contacts this is
  // a single SELECT with ~1ms latency on Turso. If the count grows, we
  // switch to a JSON-tag index or per-tag queries.
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: { id: true, tags: true },
  });

  // Build per-tag set, then per-segment union.
  const bySegment: { id: string; name: string; count: number }[] = [];
  const union = new Set<string>();
  for (const seg of segments) {
    let segCount = 0;
    for (const c of contacts) {
      try {
        const tags: string[] = JSON.parse(c.tags || '[]');
        if (tags.includes(seg.tag)) {
          union.add(c.id);
          segCount++;
        }
      } catch {}
    }
    bySegment.push({ id: seg.id, name: seg.name, count: segCount });
  }

  return NextResponse.json({
    contactIds: Array.from(union),
    count: union.size,
    bySegment,
  });
}
