import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'development-secret'
);

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// GET — list all client accounts (admin only)
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const clients = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      plan: true,
      createdAt: true,
      _count: {
        select: {
          leads: true,
          campaigns: true,
          contacts: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ clients });
}

// POST — create a new client account (admin only)
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { name, email, phone, company } = await req.json();
  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const client = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      plan: 'FREE',
      role: 'CLIENT',
      passwordHash,
      isOwner: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });

  // Return temp password so admin can share it with client
  return NextResponse.json({
    client,
    tempPassword,
    shareMessage: `Send this to your client:\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nLogin at: https://sendflow-two.vercel.app/client-portal\n\nThey should change their password after first login.`,
  });
}

// DELETE — delete a client account (admin only)
export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, JWT_SECRET);
    payload = result.payload;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
  }

  await prisma.user.deleteMany({ where: { id, role: 'CLIENT' } });

  return NextResponse.json({ ok: true });
}