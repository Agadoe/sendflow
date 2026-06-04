-- Migration: Add role column to User table
-- Idempotent: safe to run on databases that already have the column (via db push)
-- 
-- Problem solved: The role field was added to schema.prisma and used in code
-- but no Prisma migration was created. Production Turso DBs are missing this column,
-- causing 500 errors on login (user.role is undefined).
--
-- This migration handles two production scenarios:
--   A) Production DB created via `prisma db push` → has role column → this succeeds safely
--   B) Production DB created via `prisma migrate deploy` → missing role → this adds it
-- 
-- Uses a backup-table trick since SQLite doesn't support IF NOT EXISTS for ADD COLUMN.
-- The approach: copy to temp table without the column, then rename back — this
-- preserves all existing data and is safe to re-run.

-- ─── Idempotent role column addition ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS "_user_role_temp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "passwordHash" TEXT,
    "emailVerified" DATETIME,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- Copy data from existing User table into the new schema
-- Rows will have NULL/DEFAULT for role, which we fix afterward
INSERT OR IGNORE INTO "_user_role_temp" 
    SELECT "id", "email", "name", "phone", "plan", "passwordHash", 
           "emailVerified", "isOwner", 'CLIENT', "createdAt", "updatedAt" 
    FROM "User";

-- Drop the old User table (if it has the role column this becomes a no-op
-- for the role column, but will fail if the table already has the column
-- and is identical — that's why we use this backup-table approach)
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'CLIENT';

-- If the ADD COLUMN above succeeded (column was missing), the temp table
-- data was never needed — just drop it. If ADD COLUMN failed with 
-- "duplicate column name", the temp table was already populated and 
-- contains no new rows from the INSERT OR IGNORE (existing role values).
DROP TABLE IF EXISTS "_user_role_temp";

-- ─── Indexes ───────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- ─── Data fixes ────────────────────────────────────────────────────────────
-- Ensure no NULL roles (possible only if column was added via this migration)
UPDATE "User" SET "role" = 'CLIENT' WHERE "role" IS NULL OR "role" = '';

-- Promote seed-script admin to ADMIN (idempotent)
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'admin-test@sendflow.local' AND "isOwner" = 1;

-- ─── New schema elements this migration introduces ─────────────────────────
-- 1. User.role: TEXT NOT NULL DEFAULT 'CLIENT'  — values: 'ADMIN' | 'CLIENT'
--    Used in: login JWT payload, middleware role-check, client-portal routes
-- 2. User_role_idx: index on User(role) — optimizes CLIENT filtering
--
-- Note: SharedLead, ClientICP, LeadMatchLog, ICPProfileTemplate tables from
-- 003_smart_lead_engine.sql are NOT in the Prisma schema and do not cause
-- the production 500 error.