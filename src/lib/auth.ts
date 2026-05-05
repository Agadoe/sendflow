import { jwtVerify, SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'development-secret'
);

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
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, isOwner: true },
    });

    if (!user) return null;

    // Owner: no TeamMember lookup needed
    if (user.isOwner) {
      return buildSession({ ...user, role: 'OWNER' });
    }

    // Team member: look up their role
    const membership = await prisma.teamMember.findFirst({
      where: { userId },
      select: { role: true },
    });

    return buildSession({ ...user, role: membership?.role ?? 'VIEWER' });
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