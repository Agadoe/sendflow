# APPLIED — 2026-06-06 (clio)

## What
Added the `InboundEmail` table to the production Turso DB:
`sendflow-tedymiles.aws-ap-northeast-1.turso.io`

## How
Ran each statement from `migration.sql` via the `@libsql/client` Node lib against
the production Turso URL + auth token from `.env.bak`. All 5 statements
(1 CREATE TABLE + 4 CREATE INDEX) succeeded.

## Verified
- `SELECT name FROM sqlite_master WHERE type='table' AND name='InboundEmail'` → 1 row
- `PRAGMA table_info(InboundEmail)` → 20 columns (id, uid, mailbox, messageId,
  fromAddress, fromName, toAddress, cc, subject, sentAt, receivedAt, textBody,
  htmlBody, snippet, attachments, read, readAt, readBy, matchedContactId, fetchedAt)
- `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='InboundEmail'` →
  6 indexes (4 explicit + 2 auto from PRIMARY KEY and `UNIQUE (mailbox, uid)`)

## Idempotency
All statements use `IF NOT EXISTS`. Safe to re-run.

## Required follow-up
Add `MAIL_IMAP_PASS` to Vercel env (production) so the IMAP fetcher can connect
to mail.baahe.org:993 with `sendflow@baahe.org` credentials.
