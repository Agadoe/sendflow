import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/plans';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  return NextResponse.json({
    userPlan: session?.plan || null,
    freePlan: PLANS.FREE,
    starterPlanBulkSend: PLANS.STARTER.bulkSend,
    freePlanBulkSend: PLANS.FREE.bulkSend,
    timestamp: Date.now(),
  });
}
