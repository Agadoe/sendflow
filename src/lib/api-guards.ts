import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole, SessionUser } from '@/lib/auth';

/**
 * Require authentication — returns 401 if no valid session.
 */
export async function requireAuth(
  req: NextRequest,
  handler: (session: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return handler(session);
}

/**
 * Require minimum role level — returns 401 if unauthenticated, 403 if insufficient.
 */
export async function requireMinRole(
  minRole: SessionUser['role'],
  req: NextRequest,
  handler: (session: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRole(session, minRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return handler(session);
}
