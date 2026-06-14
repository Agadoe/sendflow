import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Debug only — delete after diagnosis.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  
  return NextResponse.json({
    record,
    now: new Date().toISOString(),
    record_exists: !!record,
    record_expired: record ? record.expires < new Date() : null,
  });
}