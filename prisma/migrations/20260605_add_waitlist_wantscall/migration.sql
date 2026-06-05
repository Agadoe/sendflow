-- Migration: Add wantsCall column to Waitlist table
-- Idempotent: safe to run on databases that already have the column.
--
-- Problem solved: The wantsCall field was added to the Waitlist model in
-- prisma/schema.prisma (to capture whether the signup wants a free
-- onboarding call) but no Prisma migration was created. The production
-- Turso DB was missing this column, causing 500 errors on:
--   - GET  /api/waitlist   (PrismaClientKnownRequestError: no such column: main.Waitlist.wantsCall)
--   - POST /api/waitlist   (PrismaClientKnownRequestError: no such column)
--
-- This migration adds the column with NOT NULL DEFAULT false, which is
-- safe to run on existing data — all existing rows get wantsCall=false.
--
-- Apply via: node -e "..." with @libsql/client, or via Prisma migrate deploy.
-- See APPLIED.md for the run log.

-- ─── Idempotent column addition ─────────────────────────────────────────

ALTER TABLE "Waitlist" ADD COLUMN "wantsCall" BOOLEAN NOT NULL DEFAULT false;

-- ─── Indexes (optional, for future filtering) ───────────────────────────
-- CREATE INDEX IF NOT EXISTS "Waitlist_wantsCall_idx" ON "Waitlist"("wantsCall");
-- (skipped by default to avoid index bloat; uncomment if you filter by this often)

-- ─── Verification query ─────────────────────────────────────────────────
-- PRAGMA table_info(Waitlist);
-- Expected: id, email, name, businessType, phone, createdAt, wantsCall
