import { JWT_SECRET } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

// Notification target — the same address that receives KGC leads.
// Centralizes inbound inquiries so Don doesn't have to check multiple inboxes.
const TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'sendflow@baahe.org';
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'sendflow@baahe.org';
const FROM_NAME = 'SendFlow Contact Form';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_NOTIFY_CHAT = process.env.TELEGRAM_NOTIFY_CHAT;

const transporter = nodemailer.createTransport({
  host: 'mail.baahe.org',
  port: 465,
  secure: true, // port 465 = SMTPS (TLS on connect)
  auth: {
    user: process.env.SMTP_USER || 'sendflow@baahe.org',
    pass: process.env.SMTP_PASS || '',
  },
  tls: {
    // Don't fail on self-signed certs in dev; remove if cPanel uses a trusted cert
    rejectUnauthorized: true,
  },
});

function clientIp(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return req.headers.get('x-real-ip') || null;
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/**
 * Escape user-supplied text for safe HTML interpolation.
 * (Don't accept raw HTML; messages are plain text but rendered as HTML.)
 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please use a valid email address' }, { status: 400 });
    }
    if (String(message).length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 });
    }

    // 1) Persist the message first — never lose a lead even if SMTP fails.
    const contact = await prisma.contactMessage.create({
      data: {
        name: String(name).slice(0, 200),
        email: String(email).slice(0, 200),
        phone: phone ? String(phone).slice(0, 50) : null,
        subject: subject ? String(subject).slice(0, 200) : null,
        message: String(message).slice(0, 5000),
        ip: clientIp(req),
        userAgent: req.headers.get('user-agent')?.slice(0, 500) || null,
      },
    });

    // 2) Send notification email. If it fails, log it on the row but don't fail the request —
    //    the message is already safely in the DB and visible in the dashboard.
    const safeName = esc(contact.name);
    const safeEmail = esc(contact.email);
    const safePhone = esc(contact.phone || '—');
    const safeSubject = esc(contact.subject || '(no subject)');
    const safeMessage = esc(contact.message).replace(/\n/g, '<br/>');

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0A0A0A; color: #F5F2EC; padding: 32px 40px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
            SendFlow<span style="color: #C8922A;">.</span> — New Contact Message
          </h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: rgba(245,242,236,0.45);">
            From the public contact form
          </p>
        </div>
        <div style="background: #F5F2EC; padding: 32px 40px; border-radius: 0 0 8px 8px; border: 1px solid #D8D4CC;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; font-weight: 600; color: #0A0A0A;">${safeName}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Email</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #0A0A0A;"><a href="mailto:${safeEmail}" style="color: #C8922A;">${safeEmail}</a></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Phone</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #0A0A0A;">${safePhone}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Subject</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #0A0A0A;">${safeSubject}</td></tr>
            <tr><td colspan="2" style="padding: 16px 0 0; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Message</td></tr>
            <tr><td colspan="2" style="padding: 8px 0 0; font-size: 14px; color: #0A0A0A; line-height: 1.6; background: white; border: 1px solid #D8D4CC; border-radius: 4px; padding: 16px;">${safeMessage}</td></tr>
          </table>
          <p style="font-size: 11px; color: #6B6B6B; margin-top: 24px; border-top: 1px solid #D8D4CC; padding-top: 16px;">
            Received: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' })} GMT
            <br/>IP: ${esc(contact.ip || '—')}
            <br/><a href="https://sendflow-two.vercel.app/dashboard/messages" style="color: #C8922A;">View in dashboard →</a>
          </p>
        </div>
      </div>
    `;

    const textBody = [
      `SendFlow Contact Message`,
      ``,
      `Name: ${contact.name}`,
      `Email: ${contact.email}`,
      `Phone: ${contact.phone || '—'}`,
      `Subject: ${contact.subject || '(no subject)'}`,
      ``,
      `Message:`,
      contact.message,
      ``,
      `Received: ${new Date().toISOString()}`,
      `IP: ${contact.ip || '—'}`,
      `Dashboard: https://sendflow-two.vercel.app/dashboard/messages`,
    ].join('\n');

    try {
      await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: TO_EMAIL,
        replyTo: contact.email,
        subject: `SendFlow contact: ${contact.subject || contact.name}`,
        text: textBody,
        html: htmlBody,
      });
      await prisma.contactMessage.update({
        where: { id: contact.id },
        data: { emailSent: true, emailError: null },
      });
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error('[contact] SMTP failed:', msg);
      await prisma.contactMessage.update({
        where: { id: contact.id },
        data: { emailSent: false, emailError: msg.slice(0, 500) },
      });
      // Still return success to the user — message is saved, can be re-sent from dashboard.
    }

    // 3) Telegram fallback notification. If SMTP fails, this still gets the
    //    message to Don via Telegram (the waitlist endpoint already does this).
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_NOTIFY_CHAT) {
      try {
        const telegramText = [
          '📨 *SendFlow Contact*',
          '',
          `👤 *${contact.name}*`,
          `📧 ${contact.email}`,
          contact.phone ? `📱 ${contact.phone}` : null,
          `📋 ${contact.subject || '(no subject)'}`,
          '',
          contact.message,
          '',
          `[View in dashboard](https://sendflow-two.vercel.app/dashboard/messages)`,
        ].filter(Boolean).join('\n');

        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_NOTIFY_CHAT,
              text: telegramText,
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }),
          }
        );
        if (!tgRes.ok) {
          const err = await tgRes.json().catch(() => ({}));
          console.warn('[contact] Telegram notify failed:', JSON.stringify(err).slice(0, 200));
        }
      } catch (tgErr) {
        // Telegram failure is non-fatal — DB has the message.
        console.warn('[contact] Telegram notify error:', tgErr);
      }
    }

    return NextResponse.json({
      success: true,
      id: contact.id,
      emailSent: true, // updated in DB; this reflects the optimistic response
    });
  } catch (err) {
    console.error('[contact] POST error:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

/**
 * GET /api/contact — list messages (auth required)
 * Query params:
 *   - limit (default 50, max 200)
 *   - unread (true to filter unread only)
 */
export async function GET(req: NextRequest) {
  try {
    const { jwtVerify } = await import('jose');
    const token = req.cookies.get('sf_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await jwtVerify(token, JWT_SECRET);

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
    const unread = url.searchParams.get('unread') === 'true';

    const where = unread ? { read: false } : {};
    const [messages, total, unreadCount] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.contactMessage.count(),
      prisma.contactMessage.count({ where: { read: false } }),
    ]);

    return NextResponse.json({ messages, total, unreadCount, limit });
  } catch (err) {
    console.error('[contact] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

/**
 * PATCH /api/contact — mark a message as read/unread (auth required)
 * Body: { id: string, read: boolean }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { jwtVerify } = await import('jose');
    const token = req.cookies.get('sf_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = (payload.sub as string) || null;

    const { id, read } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updated = await prisma.contactMessage.update({
      where: { id },
      data: {
        read: Boolean(read),
        readAt: read ? new Date() : null,
        readBy: read ? userId : null,
      },
    });

    return NextResponse.json({ message: updated });
  } catch (err) {
    console.error('[contact] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

/**
 * DELETE /api/contact — delete a message (auth required)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { jwtVerify } = await import('jose');
    const token = req.cookies.get('sf_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await jwtVerify(token, JWT_SECRET);

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await prisma.contactMessage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[contact] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
