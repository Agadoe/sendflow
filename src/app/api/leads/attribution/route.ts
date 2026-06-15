import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/leads/attribution
 * Returns the attribution record for the authenticated user.
 * Used by the dashboard to show where a lead came from.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession(req as NextRequest);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const attr = await prisma.leadAttribution.findUnique({
      where: { userId: session.id },
    });

    if (!attr) {
      return NextResponse.json({ attribution: null });
    }

    return NextResponse.json({
      attribution: {
        source: attr.source,
        medium: attr.medium,
        campaign: attr.campaign,
        ref: attr.ref,
        referrer: attr.referrer,
        landingUrl: attr.landingUrl,
        createdAt: attr.createdAt,
      },
    });
  } catch (err) {
    console.error('[attribution] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch attribution' }, { status: 500 });
  }
}