/**
 * GET /api/inbox/:id
 *
 * Returns the full email (including htmlBody / textBody) and marks it as read.
 */
import { JWT_SECRET } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function getUserFromJwt(req: NextRequest): Promise<string | null> {
  const { jwtVerify } = await import('jose');
  const token = req.cookies.get('sf_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getUserFromJwt(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const email = await prisma.inboundEmail.findUnique({ where: { id } });
  if (!email) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Auto-mark as read on first view
  if (!email.read) {
    await prisma.inboundEmail.update({
      where: { id },
      data: { read: true, readAt: new Date(), readBy: userId },
    });
    email.read = true;
    email.readAt = new Date();
    email.readBy = userId;
  }

  // If matched to a contact form submission, include the contact record too
  let contact = null;
  if (email.matchedContactId) {
    contact = await prisma.contactMessage.findUnique({
      where: { id: email.matchedContactId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        createdAt: true,
        read: true,
      },
    });
  }

  return NextResponse.json({ email, contact });
}
