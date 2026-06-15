/**
 * IMAP inbox fetcher for sendflow@baahe.org
 *
 * Connects to mail.baahe.org:993 (IMAPS), searches for messages newer than the
 * last seen UID, parses them, and writes them to the InboundEmail table.
 * Idempotent — re-running it picks up only new messages.
 *
 * Used by:
 *   - /api/cron/fetch-mail   (Vercel cron, every 2 min)
 *   - Manual triggers        (debugging, "fetch now" button)
 *
 * Env:
 *   MAIL_IMAP_HOST    default mail.baahe.org
 *   MAIL_IMAP_PORT    default 993
 *   MAIL_IMAP_USER    default sendflow@baahe.org
 *   MAIL_IMAP_PASS    required — same password as SMTP_PASS in cPanel
 *   MAIL_IMAP_TLS     default true
 *   MAIL_FETCH_LIMIT  default 50 (max messages per run)
 */

import { ImapFlow } from 'imapflow';
import { simpleParser, Attachment } from 'mailparser';
import { prisma } from '@/lib/prisma';

export type FetchResult = {
  ok: boolean;
  scanned: number;
  inserted: number;
  skipped: number;
  errors: number;
  highestUid: number | null;
  mailbox: string;
  durationMs: number;
  error?: string;
};

const HOST = process.env.MAIL_IMAP_HOST || 'mail.baahe.org';
const PORT = parseInt(process.env.MAIL_IMAP_PORT || '993', 10);
const USER = process.env.MAIL_IMAP_USER || 'sendflow@baahe.org';
const PASS = process.env.MAIL_IMAP_PASS || '';
const TLS = (process.env.MAIL_IMAP_TLS ?? 'true').toLowerCase() !== 'false';
const LIMIT = parseInt(process.env.MAIL_FETCH_LIMIT || '50', 10);
const MAILBOX = 'INBOX';

function snippetFromText(text: string | undefined, max = 240): string {
  if (!text) return '';
  // Collapse whitespace and trim
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? collapsed.slice(0, max) + '…' : collapsed;
}

function attachmentsToJson(atts: Attachment[] | undefined): string | null {
  if (!atts || atts.length === 0) return null;
  const summary = atts.map((a) => ({
    filename: a.filename || '(unnamed)',
    contentType: a.contentType,
    size: typeof a.size === 'number' ? a.size : null,
  }));
  return JSON.stringify(summary);
}

export async function fetchInboundMail(): Promise<FetchResult> {
  const started = Date.now();

  if (!PASS) {
    return {
      ok: false,
      scanned: 0,
      inserted: 0,
      skipped: 0,
      errors: 0,
      highestUid: null,
      mailbox: MAILBOX,
      durationMs: Date.now() - started,
      error: 'MAIL_IMAP_PASS is not set',
    };
  }

  // Find the highest UID we already have so we can ask the server for "newer than this"
  const lastRow = await prisma.inboundEmail.findFirst({
    where: { mailbox: MAILBOX },
    orderBy: { uid: 'desc' },
    select: { uid: true },
  });
  const lastUid = lastRow?.uid ?? 0;

  let client: ImapFlow | null = null;
  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let highestUid = lastUid;

  try {
    client = new ImapFlow({
      host: HOST,
      port: PORT,
      secure: TLS,
      auth: { user: USER, pass: PASS },
      logger: false,
      // Don't keep the connection alive between runs — Vercel cron = short-lived function
      emitLogs: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock(MAILBOX);
    try {
      // Search for messages with UID > lastUid. If we have no history, fetch the
      // most recent LIMIT messages so a fresh install still gets useful data.
      const searchCriteria = lastUid > 0 ? { uid: `${lastUid + 1}:*` } : { all: true };
      const uidsRaw = await client.search(searchCriteria);
      const uids: number[] = Array.isArray(uidsRaw) ? uidsRaw : [];
      scanned = uids.length;
      if (scanned === 0) {
        return {
          ok: true,
          scanned: 0,
          inserted: 0,
          skipped: 0,
          errors: 0,
          highestUid,
          mailbox: MAILBOX,
          durationMs: Date.now() - started,
        };
      }

      // Cap to LIMIT most-recent to avoid blowing up a single run
      const fetchUids = uids.slice(-LIMIT);

      for (const uid of fetchUids) {
        try {
          // Download the raw RFC822 source for parsing. We only need the body —
          // envelope fields are filled in by mailparser from the headers.
          const download = await client.download(String(uid), undefined, { uid: true });
          if (!download || !download.content) {
            errors++;
            continue;
          }
          // imapflow streams content; coalesce to a Buffer
          const chunks: Buffer[] = [];
          for await (const chunk of download.content) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const raw = Buffer.concat(chunks);

          const parsed = await simpleParser(raw);

          // Extract envelope addresses
          const from = parsed.from?.value?.[0];
          const fromAddress = (from?.address || '').toLowerCase();
          const fromName = from?.name || null;
          const toAddress = (parsed.to && 'text' in parsed.to ? parsed.to.text : '') || USER;
          const cc = parsed.cc && 'text' in parsed.cc ? parsed.cc.text : null;

          const messageId = parsed.messageId || null;
          const subject = parsed.subject || null;
          const sentAt = parsed.date || null;
          const receivedAt = sentAt;
          const textBody = parsed.text || null;
          const htmlBody = typeof parsed.html === 'string' ? parsed.html : null;
          const snippet = snippetFromText(parsed.text);
          const attachments = attachmentsToJson(parsed.attachments);

          // Try to match against an existing ContactMessage by email
          let matchedContactId: string | null = null;
          if (fromAddress) {
            // Already lowercased; SQLite equals is exact but case-equivalent in our data.
            const cm = await prisma.contactMessage.findFirst({
              where: { email: fromAddress },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            });
            matchedContactId = cm?.id ?? null;
          }

          // Upsert keyed on (mailbox, uid) so re-runs are safe
          await prisma.inboundEmail.upsert({
            where: { mailbox_uid: { mailbox: MAILBOX, uid } },
            create: {
              uid,
              mailbox: MAILBOX,
              messageId,
              fromAddress: fromAddress || 'unknown@unknown',
              fromName,
              toAddress,
              cc,
              subject,
              sentAt,
              receivedAt,
              textBody,
              htmlBody,
              snippet,
              attachments,
              matchedContactId,
            },
            update: {
              // Refresh body parts in case the server delivered a fuller copy on retry
              messageId,
              fromAddress: fromAddress || 'unknown@unknown',
              fromName,
              toAddress,
              cc,
              subject,
              sentAt,
              receivedAt,
              textBody,
              htmlBody,
              snippet,
              attachments,
              matchedContactId,
            },
          });
          inserted++;
          if (uid > highestUid) highestUid = uid;
        } catch (e) {
          errors++;
          console.error(`[imap] uid=${uid} failed:`, e instanceof Error ? e.message : e);
        }
      }
    } finally {
      lock.release();
    }
  } catch (e) {
    return {
      ok: false,
      scanned,
      inserted,
      skipped,
      errors: errors + 1,
      highestUid,
      mailbox: MAILBOX,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    if (client) {
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }
  }

  return {
    ok: errors === 0,
    scanned,
    inserted,
    skipped,
    errors,
    highestUid,
    mailbox: MAILBOX,
    durationMs: Date.now() - started,
  };
}
