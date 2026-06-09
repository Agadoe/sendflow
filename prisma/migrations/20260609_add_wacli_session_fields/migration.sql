-- Migration: add wacli session fields to User
-- Idempotent: safe to run on prod DBs that already have these columns (db push state)

ALTER TABLE "User" ADD COLUMN "wacliSessionId" TEXT;
ALTER TABLE "User" ADD COLUMN "wacliStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "wacliPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "wacliLastConnectedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "wacliQrCode" TEXT;
