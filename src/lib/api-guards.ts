import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getSession, hasRole, SessionUser } from '@/lib/auth';

/**
 * Middleware helper: require authentication and minimum role.
 * Use in API routes as:
 *   export async function POST(req: Request) {
 *     return withRole(req, 'EDITOR', async (session) => { ... });
 *   }
 */
export function withRole(
  req: NextRequest,
  minRole: SessionUser['role'],
  handler: (session: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return handler(null as any); // placeholder — see actual function below
}

export function requireAuth(
  req: NextRequest,
  handler: (session: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return getSession(req).then(session => {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return handler(session);
  });
}

export function requireMinRole(
  minRole: SessionUser['role'],
  req: NextRequest,
  handler: (session: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return getSession(req).then(session => {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(session, minRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return handler(session);
  });
}