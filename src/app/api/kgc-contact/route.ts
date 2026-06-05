import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'mail.baahe.org',
  port: 465,
  secure: true, // port 465 = SMTPS (TLS on connect)
  auth: {
    user: process.env.SMTP_USER || 'sendflow@baahe.org',
    pass: process.env.SMTP_PASS || '',
  },
  tls: {
    rejectUnauthorized: true,
  },
});

export async function POST(req: Request) {
  try {
    const { name, email, company, phone, plan, message } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
    }

    const subject = `KGC Lead: ${name}${company ? ` from ${company}` : ''}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0A0A0A; color: #F5F2EC; padding: 32px 40px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
            KGC<span style="color: #C8922A;">.</span> — New Contact Form Lead
          </h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: rgba(245,242,236,0.45);">Kaizen Global Consult</p>
        </div>
        <div style="background: #F5F2EC; padding: 32px 40px; border-radius: 0 0 8px 8px; border: 1px solid #D8D4CC;">
          <table style="width: 100%; border-collapse: collapse;">
            ${company ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Company</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; font-weight: 600; color: #0A0A0A;">${company}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; font-weight: 600; color: #0A0A0A;">${name}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Email</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #0A0A0A;"><a href="mailto:${email}" style="color: #C8922A;">${email}</a></td></tr>
            ${phone ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Phone</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #0A0A0A;">${phone}</td></tr>` : ''}
            ${plan ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Plan Interest</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #C8922A; font-weight: 600;">${plan}</td></tr>` : ''}
            ${message ? `<tr><td style="padding: 12px 0 4px; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Message</td></tr><tr><td colspan="2" style="padding: 4px 0 12px; font-size: 14px; color: #0A0A0A; line-height: 1.6;">${message}</td></tr>` : ''}
          </table>
          <p style="font-size: 11px; color: #6B6B6B; margin-top: 24px; border-top: 1px solid #D8D4CC; padding-top: 16px;">
            Received: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' })} GMT
          </p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"KGC Website" <kaizenglobalconsult@gmail.com>`,
        to: 'Kaizensalesconsult@gmail.com',
        replyTo: email,
        subject,
        html: htmlBody,
      });
    } catch (mailErr) {
      // SMTP not configured — log and continue
      console.log('[kgc-contact] SMTP send failed, logging instead:', mailErr);
    }

    console.log('━━━ KGC CONTACT FORM ━━━');
    console.log('Name:', name, '| Email:', email, '| Company:', company, '| Phone:', phone, '| Plan:', plan);
    console.log('Message:', message);
    console.log('Time:', new Date().toISOString());

    return NextResponse.json({ ok: true, message: 'We will be in touch within 24 hours.' });
  } catch (err) {
    console.error('[kgc-contact] Error:', err);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }
}