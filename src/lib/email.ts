/**
 * SendFlow email client — Resend for production, nodemailer for local dev.
 *
 * Production path (RESEND_API_KEY set): uses Resend API (bypasses Vercel
 * serverless SMTP restrictions). Free tier = 100 emails/day.
 *
 * Local/dev path (no RESEND_API_KEY): falls back to nodemailer + baahe.org
 * cPanel SMTP (the original behaviour).
 *
 * Used by /api/auth/magic-link, /api/contact, /api/kgc-contact, and (soon)
 * the waitlist drip + email-verification flow.
 *
 * Env vars:
 *   RESEND_API_KEY        — Resend API key (production, Resend free tier)
 *   SMTP_HOST             — nodemailer fallback: default mail.baahe.org
 *   SMTP_PORT             — nodemailer fallback: default 465
 *   SMTP_SECURE           — nodemailer fallback: default true
 *   SMTP_USER             — nodemailer fallback: default sendflow@baahe.org
 *   SMTP_PASS             — nodemailer fallback: required in production
 *   FROM_NAME             — default: "SendFlow"
 *   FROM_EMAIL            — default: sendflow@baahe.org
 *
 * Test rule: every test email routes to Tedymiles7@gmail.com first.
 */

import nodemailer from 'nodemailer';

// ── Resend (production) ───────────────────────────────────────────────────────
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ── nodemailer (local dev fallback) ──────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST || 'mail.baahe.org';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'; // default true
const _rawUser = process.env.SMTP_USER || 'sendflow@baahe.org';
const _rawPass = process.env.SMTP_PASS || '';
const SMTP_USER = _rawUser.replace(/\\n$/, '').trim();
const SMTP_PASS = _rawPass.replace(/\\n$/, '').trim();

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: true },
  });
  return cachedTransporter;
}

// ── Shared config ────────────────────────────────────────────────────────────
const FROM_NAME = process.env.FROM_NAME || 'SendFlow';
const FROM_EMAIL = (process.env.FROM_EMAIL || 'sendflow@baahe.org').replace(/\\n$/, '').trim();

// Don's catch-all inbox for tests / verifications. All SendFlow email flows
// MUST land here first; production recipients only after manual sign-off.
export const APPROVAL_INBOX = 'Tedymiles7@gmail.com';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  /** If true, rewrite `to` to the approval inbox (Tedymiles7@gmail.com) and
   *  prefix the subject with [TEST]. Use this in dev/staging and any time a
   *  flow hasn't been signed off. */
  testMode?: boolean;
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** Recipient the email was actually sent to (after testMode rewrite). */
  deliveredTo: string | string[];
}

export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  let to = opts.to;
  let subject = opts.subject;

  if (opts.testMode) {
    to = APPROVAL_INBOX;
    subject = `[TEST] ${subject}`;
  }

  if (!opts.text && !opts.html) {
    return { ok: false, error: 'Either text or html is required', deliveredTo: to };
  }

  // ── Production: Resend API ────────────────────────────────────────────────
  if (resend) {
    try {
      const recipients = Array.isArray(to) ? to : [to];
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: recipients,
        subject,
        text: opts.text,
        html: opts.html,
        replyTo: opts.replyTo,
      });
      if (error) {
        return { ok: false, error: error.message, deliveredTo: to };
      }
      return { ok: true, messageId: data?.id, deliveredTo: to };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg, deliveredTo: to };
    }
  }

  // ── Local dev fallback: nodemailer ──────────────────────────────────────
  try {
    const info = await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    return { ok: true, messageId: info.messageId, deliveredTo: to };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, deliveredTo: to };
  }
}

/**
 * Verify SMTP connection (nodemailer fallback only).
 * For Resend, the connection is implicit in the API call.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (resend) {
    // Resend doesn't have a ping — a zero-recipient send is the cheapest check.
    // We just return ok=true and let the first real send catch auth errors.
    return { ok: true };
  }
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
