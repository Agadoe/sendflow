import { getJWTSecret } from '@/lib/jwt';
import { jwtVerify, SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';


export interface SessionUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER' | 'OWNER';
  isOwner: boolean;
}

function buildSession(user: {
  id: string;
  email: string;
  name: string;
  plan: string;
  isOwner: boolean;
  role?: string | null;
}): SessionUser {
  const role = user.isOwner
    ? 'OWNER'
    : (user.role as SessionUser['role']) || 'VIEWER';
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    role,
    isOwner: user.isOwner,
  };
}
/**
 * Extract and verify the sf_token cookie, returning the session user with role.
 */
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get('sf_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    const userId = payload.sub as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, isOwner: true, role: true },
    });

    if (!user) return null;

    return buildSession(user);
  } catch {
    return null;
  }
}

/**
 * Require a valid session — throws a 401 JSON response if not authenticated.
 */
export async function requireSession(req: NextRequest): Promise<SessionUser> {
  const session = await getSession(req);
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}

/**
 * Role-hierarchy check: OWNER > ADMIN > EDITOR > VIEWER
 */
export function hasRole(session: SessionUser, minRole: SessionUser['role']): boolean {
  const hierarchy: SessionUser['role'][] = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'];
  return hierarchy.indexOf(session.role) >= hierarchy.indexOf(minRole);
}

/**
 * Guard: require minimum role level. Throws 403 if insufficient.
 */
export async function requireRole(req: NextRequest, minRole: SessionUser['role']): Promise<SessionUser> {
  const session = await requireSession(req);
  if (!hasRole(session, minRole)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}

/**
 * Convenience: read the session from the current request's cookies via
 * next/headers. Use this in route handlers that don't already receive a
 * NextRequest. Returns null if no valid session.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    const userId = payload.sub as string;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, isOwner: true, role: true },
    });
    if (!user) return null;

    return buildSession(user);
  } catch {
    return null;
  }
}