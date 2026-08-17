-- Add channel column to Campaign (whatsapp | sms). Additive: existing
-- campaigns default to "whatsapp" so current behaviour is unchanged. SMS
-- campaigns route sends through the SMS provider layer (src/lib/sms)
-- instead of the wacli daemon.
ALTER TABLE "Campaign" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'whatsapp';