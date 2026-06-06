-- Migration: InboundEmail (IMAP inbox mirror)
-- Created: 2026-06-06 (clio)
-- Reason: Don sends Gmail -> sendflow@baahe.org and expects to see it in the
-- SendFlow dashboard. There's no IMAP poller in the codebase — the
-- /dashboard/messages view only shows contact form submissions. This table
-- is the destination for the IMAP fetcher at src/lib/mail-fetcher.ts.

CREATE TABLE IF NOT EXISTS "InboundEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" INTEGER NOT NULL,
    "mailbox" TEXT NOT NULL DEFAULT 'INBOX',
    "messageId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddress" TEXT NOT NULL,
    "cc" TEXT,
    "subject" TEXT,
    "sentAt" DATETIME,
    "receivedAt" DATETIME,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "snippet" TEXT NOT NULL DEFAULT '',
    "attachments" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT 0,
    "readAt" DATETIME,
    "readBy" TEXT,
    "matchedContactId" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboundEmail_mailbox_uid_unique" UNIQUE ("mailbox", "uid")
);

CREATE INDEX IF NOT EXISTS "InboundEmail_receivedAt_idx" ON "InboundEmail"("receivedAt");
CREATE INDEX IF NOT EXISTS "InboundEmail_fromAddress_idx" ON "InboundEmail"("fromAddress");
CREATE INDEX IF NOT EXISTS "InboundEmail_read_idx" ON "InboundEmail"("read");
CREATE INDEX IF NOT EXISTS "InboundEmail_messageId_idx" ON "InboundEmail"("messageId");
