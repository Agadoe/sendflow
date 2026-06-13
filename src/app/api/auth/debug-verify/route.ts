import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Debug only — delete after diagnosis.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true, createdAt: true },
  });

  return NextResponse.json({
    user,
    emailVerified_type: user?.emailVerified == null ? 'null' : typeof user?.emailVerified,
    emailVerified_truthy: user?.emailVerified ? true : false,
    gate_would_block: !user?.emailVerified,
  });
}