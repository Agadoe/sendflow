import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { name, email, phone, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email and message are required' }, { status: 400 });
    }

    // Store the message in DB (or forward via email)
    await prisma.lead.create({
      data: {
        name,
        email,
        phone: phone || null,
        source: 'contact_form',
        status: subject || 'NEW',
        notes: `[${subject || 'general'}] ${message}`,
      },
    });

    // TODO: forward to support email via Resend/SendGrid
    // For now, log it
    console.log(`[contact] ${name} <${email}> [${subject}]: ${message}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}