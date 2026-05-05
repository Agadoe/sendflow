import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  // Return full session including role and isOwner
  return NextResponse.json({
    user: {
      id: session.id,
      email: session.email,
      name: session.name,
      plan: session.plan,
      role: session.role,
      isOwner: session.isOwner,
    },
  });
}
