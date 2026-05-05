import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const segments = await prisma.contact.findMany({
    where: { userId },
    select: { tags: true, createdAt: true },
  });

  // Build simple aggregate segments from existing tags
  const tagMap = new Map<string, number>();
  for (const c of segments) {
    try {
      const tags: string[] = JSON.parse(c.tags || '[]');
      for (const t of tags) {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      }
    } catch {}
  }

  return NextResponse.json({ segments: Array.from(tagMap.entries()).map(([name, count]) => ({ name, count })) });
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, tag } = await req.json();
  if (!name || !tag) return NextResponse.json({ error: 'name and tag required' }, { status: 400 });

  // For now, just save a named segment as a single tag filter
  // This could be extended to store multi-filter segments in a separate table
  return NextResponse.json({ message: 'Segments are derived from contact tags. Apply tag filters when sending campaigns.' });
}