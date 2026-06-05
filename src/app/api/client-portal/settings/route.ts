import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;

    if (payload.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;

    if (payload.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, phone, email } = await req.json();
    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) {
      // Check email uniqueness
      const existing = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
      updateData.email = email;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true },
    });

    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  // Password change
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub as string;

    if (payload.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both passwords required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Cannot change password' }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password incorrect' }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Password change failed' }, { status: 500 });
  }
}