-- Migration: WaitlistSubmission audit table
-- Created: 2026-06-04 (clio)
-- Reason: Original Waitlist had no phone, Mailchimp merge fields didn't exist on
-- the production list, and there was no way to backfill or track sync health.
-- This adds an immutable per-submission log so we never lose data again.

CREATE TABLE IF NOT EXISTS "WaitlistSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waitlistId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "businessType" TEXT,
    "wantsCall" BOOLEAN NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "ip" TEXT,
    "userAgent" TEXT,
    "mailchimpStatus" TEXT NOT NULL DEFAULT 'pending',
    "mailchimpError" TEXT,
    "mailchimpSyncedAt" DATETIME,
    "telegramStatus" TEXT NOT NULL DEFAULT 'pending',
    "telegramError" TEXT,
    "telegramSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaitlistSubmission_waitlistId_fkey" FOREIGN KEY ("waitlistId") REFERENCES "Waitlist"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "WaitlistSubmission_email_idx" ON "WaitlistSubmission"("email");
CREATE INDEX IF NOT EXISTS "WaitlistSubmission_phone_idx" ON "WaitlistSubmission"("phone");
CREATE INDEX IF NOT EXISTS "WaitlistSubmission_createdAt_idx" ON "WaitlistSubmission"("createdAt");
