import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieHeader = req.headers.get('cookie');
  const userId = cookieHeader ? cookieHeader.match(/sf_token=([^;]+)/)?.[1] : null;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.contact.deleteMany({ where: { id, userId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}