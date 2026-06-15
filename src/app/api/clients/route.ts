import { JWT_SECRET } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { sendMail } from '@/lib/email';
import { createClientSchema } from '@/lib/validation';


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

  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors.map(e => e.message).join('. ');
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { name, email, phone } = parsed.data;

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

  // Email temp password directly to the client (never return in API response)
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sendflow-two.vercel.app';
  const mailResult = await sendMail({
    to: email,
    subject: 'Your SendFlow client portal account',
    text: [
      `Hi ${name},`,
      ``,
      `An admin has created a SendFlow account for you.`,
      ``,
      `Login: ${loginUrl}/client-portal`,
      `Email: ${email}`,
      `Temporary Password: ${tempPassword}`,
      ``,
      `Please change your password after your first login.`,
    ].join('\n'),
    html: `
      <p>Hi ${name},</p>
      <p>An admin has created a SendFlow account for you.</p>
      <p style="margin:16px 0">
        <strong>Login:</strong> <a href="${loginUrl}/client-portal">${loginUrl}/client-portal</a><br/>
        <strong>Email:</strong> ${email}<br/>
        <strong>Temporary Password:</strong> <code>${tempPassword}</code>
      </p>
      <p>Please change your password after your first login.</p>
    `,
    testMode: false,
  });

  if (!mailResult.ok) {
    console.error('[clients] failed to email temp password:', mailResult.error, { to: email });
    // Still return 201 — account was created, but warn admin
    return NextResponse.json(
      {
        client,
        warning: 'Account created, but the temporary password could not be emailed. Please generate a password reset for this client.',
      },
      { status: 201 }
    );
  }

  return NextResponse.json(
    {
      client,
      message: 'Account created and login credentials emailed to client.',
    },
    { status: 201 }
  );
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