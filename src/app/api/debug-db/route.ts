import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ status: 'ok', db: 'connected', userCount: count });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', db: 'failed', error: err.message }, { status: 500 });
  }
}