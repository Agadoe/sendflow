import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export async function GET(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only owners/admins can see team
  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.id, OR: [{ role: 'ADMIN' }, { userId: session.id }] },
  });
  if (!membership && !session.isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get the owner's account to find all team members under it
  const owner = await prisma.user.findFirst({
    where: { id: session.id, isOwner: true },
    include: {
      teamMembers: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { invitedAt: 'asc' },
      },
    },
  });

  // If not owner, find via team membership
  const teamMembers = owner
    ? owner.teamMembers
    : await prisma.teamMember.findMany({
        where: { userId: session.id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

  const members = teamMembers.map(tm => ({
    id: tm.user.id,
    name: tm.user.name,
    email: tm.user.email,
    role: tm.role,
    joinedAt: tm.joinedAt,
    invitedAt: tm.invitedAt,
  }));

  return NextResponse.json({ members, isOwner: session.isOwner });
}

export async function POST(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: 'email and role required' }, { status: 400 });
  if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Check if user already exists
  const invitee = await prisma.user.findUnique({ where: { email } });
  if (invitee) {
    // Already a member
    const existing = await prisma.teamMember.findFirst({ where: { userId: invitee.id } });
    if (existing) return NextResponse.json({ error: 'User is already a team member' }, { status: 409 });

    // Add as team member directly
    const tm = await prisma.teamMember.create({
      data: { userId: invitee.id, email, role, joinedAt: new Date() },
    });
    return NextResponse.json({ member: { ...tm, user: { id: invitee.id, name: invitee.name, email } } });
  }

  // Generate invite token and create pending membership
  const token = randomBytes(32).toString('hex');
  const tm = await prisma.teamMember.create({
    data: {
      email,
      role,
      token,
      invitedBy: session.id,
      userId: session.id, // pending, linked to owner
    },
  });

  // TODO: send invite email with magic link: /invite?token=token

  return NextResponse.json({ invite: { email, role, token }, member: null });
}