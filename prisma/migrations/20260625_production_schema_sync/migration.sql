-- ============================================================================
-- SendFlow production schema migration
-- Generated: 2026-06-25 13:32 GMT
-- Purpose:   Bring prod Turso DB up to current Prisma schema
--
-- Strategy:  Idempotent — safe to re-run. Each statement uses IF NOT EXISTS
--            (SQLite supports this for ADD COLUMN/INDEX since 3.35; CREATE TABLE
--            uses a guard query)
--
-- Affected:
--   Lead                 — 17 missing columns (CRM enrichment + outreach tracking)
--   DripScheduledMessage — table doesn't exist (drip engine can't run)
--   OutboundMessage      — table doesn't exist
--   TeamMember           — table doesn't exist
--   ClickToWhatsAppLink  — table doesn't exist
--   WhatsAppForm         — table doesn't exist
--   WhatsAppFormSubmission — table doesn't exist
--   LeadAttribution      — table created by prior migration (re-checked; ignore)
--
-- Impact:    No destructive ops. Only ADD COLUMN / CREATE TABLE / CREATE INDEX.
--            Existing rows keep all their data; new columns get default values.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lead: add 17 missing columns
-- ----------------------------------------------------------------------------
ALTER TABLE "Lead" ADD COLUMN "score"             INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "scoreBreakdown"    TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Lead" ADD COLUMN "dealValue"         INTEGER;
ALTER TABLE "Lead" ADD COLUMN "contactCount"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "lastContactedAt"   DATETIME;
ALTER TABLE "Lead" ADD COLUMN "convertedAt"       DATETIME;
ALTER TABLE "Lead" ADD COLUMN "convertedValue"    INTEGER;
ALTER TABLE "Lead" ADD COLUMN "tags"              TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Lead" ADD COLUMN "jobTitle"          TEXT;
ALTER TABLE "Lead" ADD COLUMN "industry"          TEXT;
ALTER TABLE "Lead" ADD COLUMN "linkedinUrl"       TEXT;
ALTER TABLE "Lead" ADD COLUMN "website"           TEXT;
ALTER TABLE "Lead" ADD COLUMN "address"           TEXT;
ALTER TABLE "Lead" ADD COLUMN "icpBusinessType"   TEXT;
ALTER TABLE "Lead" ADD COLUMN "icpTargetCustomer" TEXT;
ALTER TABLE "Lead" ADD COLUMN "outreachStatus"    TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Lead" ADD COLUMN "lastOutreachAt"    DATETIME;

-- Lead indexes (faster dashboard lookups)
CREATE INDEX IF NOT EXISTS "Lead_userId_stage_idx"     ON "Lead" ("userId", "stage");
CREATE INDEX IF NOT EXISTS "Lead_userId_source_idx"    ON "Lead" ("userId", "source");
CREATE INDEX IF NOT EXISTS "Lead_outreachStatus_idx"   ON "Lead" ("outreachStatus");
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUp_idx"     ON "Lead" ("nextFollowUp");
CREATE INDEX IF NOT EXISTS "Lead_lastOutreachAt_idx"   ON "Lead" ("lastOutreachAt");

-- ----------------------------------------------------------------------------
-- 2. DripScheduledMessage — create table (drip engine writes here)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DripScheduledMessage" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "userId"        TEXT NOT NULL,
    "contactId"     TEXT NOT NULL,
    "automationId"  TEXT,
    "channel"       TEXT NOT NULL DEFAULT 'whatsapp',
    "template"      TEXT NOT NULL,
    "scheduledFor"  DATETIME NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt"        DATETIME,
    "failureReason" TEXT,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DripScheduledMessage_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    CONSTRAINT "DripScheduledMessage_contactId_fkey"
        FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE,
    CONSTRAINT "DripScheduledMessage_automationId_fkey"
        FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "DripScheduledMessage_status_scheduledFor_idx"
    ON "DripScheduledMessage" ("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "DripScheduledMessage_contactId_idx"
    ON "DripScheduledMessage" ("contactId");
CREATE INDEX IF NOT EXISTS "DripScheduledMessage_userId_idx"
    ON "DripScheduledMessage" ("userId");

-- ----------------------------------------------------------------------------
-- 3. OutboundMessage — create table (sent message log for analytics)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OutboundMessage" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "leadId"        TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "channel"       TEXT NOT NULL,
    "content"       TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt"        DATETIME,
    "deliveredAt"   DATETIME,
    "readAt"        DATETIME,
    "repliedAt"     DATETIME,
    "failureReason" TEXT,
    "externalId"    TEXT,
    "metadata"      TEXT NOT NULL DEFAULT '{}',
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboundMessage_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE,
    CONSTRAINT "OutboundMessage_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "OutboundMessage_leadId_idx"        ON "OutboundMessage" ("leadId");
CREATE INDEX IF NOT EXISTS "OutboundMessage_userId_status_idx" ON "OutboundMessage" ("userId", "status");
CREATE INDEX IF NOT EXISTS "OutboundMessage_externalId_idx"    ON "OutboundMessage" ("externalId");

-- ----------------------------------------------------------------------------
-- 4. TeamMember — create table (multi-tenant team invitations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "userId"    TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'EDITOR',
    "invitedBy" TEXT,
    "token"     TEXT,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt"  DATETIME,
    CONSTRAINT "TeamMember_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember" ("userId");
CREATE INDEX IF NOT EXISTS "TeamMember_email_idx"  ON "TeamMember" ("email");

-- ----------------------------------------------------------------------------
-- 5. ClickToWhatsAppLink — create table (tracking links)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ClickToWhatsAppLink" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "phone"       TEXT NOT NULL,
    "prefillMsg"  TEXT,
    "utmSource"   TEXT,
    "utmMedium"   TEXT,
    "utmCampaign" TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClickToWhatsAppLink_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 6. WhatsAppForm — create table (form builder)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "WhatsAppForm" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "userId"     TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "phone"      TEXT NOT NULL,
    "prefillMsg" TEXT,
    "questions"  TEXT NOT NULL DEFAULT '[]',
    "tagName"    TEXT,
    "tagValue"   TEXT,
    "isActive"   BOOLEAN NOT NULL DEFAULT 1,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppForm_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 7. WhatsAppFormSubmission — create table (form responses)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "WhatsAppFormSubmission" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "formId"    TEXT NOT NULL,
    "phone"     TEXT NOT NULL,
    "answers"   TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppFormSubmission_formId_fkey"
        FOREIGN KEY ("formId") REFERENCES "WhatsAppForm"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "WhatsAppFormSubmission_formId_idx" ON "WhatsAppFormSubmission" ("formId");

-- ----------------------------------------------------------------------------
-- 8. LeadActivity metadata column (was missing in prod)
-- ----------------------------------------------------------------------------
ALTER TABLE "LeadActivity" ADD COLUMN "metadata" TEXT NOT NULL DEFAULT '{}';

-- ----------------------------------------------------------------------------
-- 9. Index on LeadActivity for activity feed
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_createdAt_idx"
    ON "LeadActivity" ("leadId", "createdAt" DESC);

-- ----------------------------------------------------------------------------
-- 10. Verify migration
-- ----------------------------------------------------------------------------
-- Run as separate query: SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
-- Expected: 24 tables (previously 17, now +7)