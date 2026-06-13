/**
 * SendFlow email client — wraps nodemailer for the cPanel baahe.org mailbox.
 *
 * Used by /api/auth/magic-link, /api/contact, /api/kgc-contact, and (soon)
 * the waitlist drip + email-verification flow.
 *
 * Env vars (all optional — defaults match the verified production setup from
 * MEMORY.md 2026-06-06):
 *   SMTP_HOST          — default: mail.baahe.org
 *   SMTP_PORT          — default: 465
 *   SMTP_SECURE        — default: true (TLS on connect)
 *   SMTP_USER          — default: sendflow@baahe.org
 *   SMTP_PASS          — required in production
 *   FROM_NAME          — default: "SendFlow"
 *   FROM_EMAIL         — default: sendflow@baahe.org
 *
 * Test rule: every test email routes to Tedymiles7@gmail.com first.
 */

import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'mail.baahe.org';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'; // default true
// cPanel exports sometimes include a literal "\n" at the end of secrets
// (escape sequence, not a real newline). Strip it so SMTP auth works.
const _rawUser = process.env.SMTP_USER || 'sendflow@baahe.org';
const _rawPass = process.env.SMTP_PASS || '';
const SMTP_USER = _rawUser.replace(/\\n$/, '').trim();
const SMTP_PASS = _rawPass.replace(/\\n$/, '').trim();
const FROM_NAME = process.env.FROM_NAME || 'SendFlow';
const FROM_EMAIL = (process.env.FROM_EMAIL || SMTP_USER).replace(/\\n$/, '').trim();

// Don's catch-all inbox for tests / verifications. All SendFlow email flows
// MUST land here first; production recipients only after manual sign-off.
export const APPROVAL_INBOX = 'Tedymiles7@gmail.com';

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
 * Verify the SMTP connection. Use in /api/health or before sending the first
 * campaign in a session. Returns ok=true on successful auth + connect.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
