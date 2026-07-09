import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Public, cacheable (revalidate every 5 min) — no PII, just an integer.
// Used by the marketing homepage to display a real signup count instead
// of a hardcoded placeholder.
//
// Caching strategy:
// - Edge/CDN: `s-maxage=300, stale-while-revalidate=600` so the count is
//   served from Vercel's edge cache and the DB only sees 1 query per
//   5 minutes per region.
// - Browser: `max-age=60` so refreshes within a minute don't re-query.

export const dynamic = 'force-dynamic'; // we still want ISR-friendly headers, just not full static

export async function GET() {
  try {
    const count = await prisma.waitlistSubmission.count();
    return NextResponse.json(
      { count, source: 'db' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600, max-age=60',
        },
      }
    );
  } catch (err) {
    // Never fail the marketing page because of a count error.
    // Return 0 with a stale-while-revalidate so the edge keeps the
    // last good value visible if we do recover.
    return NextResponse.json(
      { count: 0, source: 'fallback', error: 'unavailable' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
        },
      }
    );
  }
}
