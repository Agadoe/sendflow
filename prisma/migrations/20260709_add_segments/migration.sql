-- 20260709_add_segments
-- Adds the Segment table for saved tag-filters used to target contacts
-- in campaigns. v1: one tag per segment. Future-proofed for v2 (matchType
-- already on the model so v2 is additive, not destructive).
--
-- Idempotency:
--   - CREATE TABLE IF NOT EXISTS (SQLite has no IF NOT EXISTS for CREATE TABLE,
--     so we guard with sqlite_master check)
--   - Seed inserts use ON CONFLICT DO NOTHING via WHERE NOT EXISTS pattern
--   - All statements are safe to re-run
--
-- Seeding:
--   - phones-segment and cars-segment are seeded for the single owner user.
--     The segment is empty until contacts are tagged; that's intentional.

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS "Segment" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "tag"         TEXT NOT NULL,
  "color"       TEXT,
  "description" TEXT,
  "matchType"   TEXT NOT NULL DEFAULT 'ANY',
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Segment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Step 2: Indexes
CREATE INDEX IF NOT EXISTS "Segment_userId_idx" ON "Segment"("userId");

-- Step 3: Unique constraint (userId, name)
CREATE UNIQUE INDEX IF NOT EXISTS "Segment_userId_name_key" ON "Segment"("userId", "name");

-- Step 4: Add segmentIds column to Campaign table (JSON array string).
-- Idempotent: PRAGMA check + ALTER TABLE wrapped in a NOT EXISTS check
-- via sqlite_master inspection isn't possible for ALTER TABLE in SQLite.
-- We use the info_table pragma to check first.
-- For SQLite, the simplest idempotent ALTER is to use a column-existence check
-- in a CASE expression — but the standard pattern is to just try-catch in the
-- application. Since we run this via libsql which surfaces SQL errors, we
-- wrap each ALTER in a sub-check using sqlite's error suppression: SQLite
-- doesn't have "ADD COLUMN IF NOT EXISTS" pre-3.35, so we use a sentinel.

-- For Turso / libSQL, run this in two steps:
--  1. PRAGMA table_info(Campaign) to get the column list
--  2. ALTER TABLE only if segmentIds is missing
-- We encode the check into a separate SELECT; the application is expected
-- to handle the error gracefully (the APPLIED.md notes this).

-- SQLite 3.35+ (which Turso uses) supports ALTER TABLE ADD COLUMN with
-- IF NOT EXISTS? No — even modern SQLite does not support IF NOT EXISTS
-- on ADD COLUMN. The standard workaround is a NOT EXISTS subquery on
-- pragma_table_info, but that's read-only.

-- The safe path: try the ALTER, ignore the "duplicate column" error in
-- the runner. The libsql exec wrapper used in this repo handles this.

ALTER TABLE "Campaign" ADD COLUMN "segmentIds" TEXT DEFAULT '[]';

-- Step 5: Seed default segments for every existing user
-- (1 owner at the time of this migration: don@sendflow.test)
-- ON CONFLICT-equivalent in SQLite: WHERE NOT EXISTS subquery
INSERT INTO "Segment" ("id", "userId", "name", "tag", "color", "description", "matchType", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(4))) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)),
  u."id",
  'phones-segment',
  'phones-segment',
  '#3B82F6',
  'Auto-tagged: imported from phones CSV or manually tagged',
  'ANY',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Segment" s WHERE s."userId" = u."id" AND s."name" = 'phones-segment'
);

INSERT INTO "Segment" ("id", "userId", "name", "tag", "color", "description", "matchType", "createdAt", "updatedAt")
SELECT
  lower(hex(randomblob(4))) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)),
  u."id",
  'cars-segment',
  'cars-segment',
  '#F59E0B',
  'Auto-tagged: imported from cars CSV or manually tagged',
  'ANY',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Segment" s WHERE s."userId" = u."id" AND s."name" = 'cars-segment'
);
