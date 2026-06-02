-- Smart Lead Classification Engine v2 — Idempotent migration
-- Run this migration multiple times safely — it skips already-existing columns/tables

-- ─────────────────────────────────────────────────────────────
-- ENRICHED LEAD MODEL — skip if columns exist
-- ─────────────────────────────────────────────────────────────
-- Lead enrichment fields added via previous migration or idempotent below


-- ─────────────────────────────────────────────────────────────
-- PLATFORM SHARED LEAD POOL
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SharedLead" (
  id               TEXT    PRIMARY KEY,
  name             TEXT,
  phone            TEXT,
  email            TEXT,
  industry         TEXT    DEFAULT 'unknown',
  geography        TEXT    DEFAULT 'unknown',
  intent_level     TEXT    DEFAULT 'unknown',
  buyer_profile    TEXT    DEFAULT 'general',
  budget_range     TEXT    DEFAULT 'unknown',
  price            TEXT,
  location_text    TEXT,
  description      TEXT,
  original_url     TEXT,
  engagement_score INTEGER DEFAULT 0,
  last_engaged_at  TEXT,
  outreach_count   INTEGER DEFAULT 0,
  lead_type        TEXT    DEFAULT 'scraped',
  tags             TEXT    DEFAULT '[]',
  source           TEXT,
  icp_matches      TEXT    DEFAULT '[]',
  confidence_score INTEGER DEFAULT 50,
  is_active        INTEGER DEFAULT 1,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sl_geography  ON "SharedLead"(geography);
CREATE INDEX IF NOT EXISTS idx_sl_industry   ON "SharedLead"(industry);
CREATE INDEX IF NOT EXISTS idx_sl_intent    ON "SharedLead"(intent_level);
CREATE INDEX IF NOT EXISTS idx_sl_active    ON "SharedLead"(is_active);
CREATE INDEX IF NOT EXISTS idx_sl_source    ON "SharedLead"(source);

-- ─────────────────────────────────────────────────────────────
-- CLIENT ICP REGISTRATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ClientICP" (
  id               TEXT    PRIMARY KEY,
  userId           TEXT    NOT NULL,
  name             TEXT    NOT NULL,
  industry         TEXT,
  geography        TEXT,
  buyer_profile    TEXT,
  intent_level     TEXT,
  budget_min       INTEGER,
  budget_max       INTEGER,
  weights          TEXT    DEFAULT '{"industry":1,"geography":1,"buyer_profile":2,"intent_level":2,"budget":1}',
  is_active        INTEGER DEFAULT 1,
  notify_on_match  INTEGER DEFAULT 1,
  auto_push        INTEGER DEFAULT 0,
  push_threshold   INTEGER DEFAULT 70,
  daily_push_limit INTEGER DEFAULT 50,
  max_leads_total  INTEGER DEFAULT 1000,
  lead_count       INTEGER DEFAULT 0,
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_icp_user      ON "ClientICP"(userId);
CREATE INDEX IF NOT EXISTS idx_icp_industry  ON "ClientICP"(industry);
CREATE INDEX IF NOT EXISTS idx_icp_geography ON "ClientICP"(geography);
CREATE INDEX IF NOT EXISTS idx_icp_active    ON "ClientICP"(is_active);

-- ─────────────────────────────────────────────────────────────
-- LEAD MATCH LOG
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadMatchLog" (
  id                 TEXT    PRIMARY KEY,
  shared_lead_id     TEXT,
  icp_id             TEXT,
  client_id          TEXT,
  icp_score          INTEGER DEFAULT 0,
  was_pushed         INTEGER DEFAULT 0,
  was_accepted      INTEGER DEFAULT 0,
  was_converted      INTEGER DEFAULT 0,
  revenue_generated  INTEGER DEFAULT 0,
  created_at         TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lml_lead    ON "LeadMatchLog"(shared_lead_id);
CREATE INDEX IF NOT EXISTS idx_lml_icp    ON "LeadMatchLog"(icp_id);
CREATE INDEX IF NOT EXISTS idx_lml_client ON "LeadMatchLog"(client_id);

-- ─────────────────────────────────────────────────────────────
-- ICP PROFILE TEMPLATES — seed data
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ICPProfileTemplate" (
  id             TEXT    PRIMARY KEY,
  code           TEXT    UNIQUE NOT NULL,
  label          TEXT    NOT NULL,
  description    TEXT,
  buyer_signals  TEXT,
  top_sources    TEXT,
  personas       TEXT,
  created_at     TEXT    DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO "ICPProfileTemplate" (id, code, label, description, buyer_signals, top_sources, personas) VALUES
  (lower(hex(randomblob(16))), 'prominent_business_people',
   'Business Owners with Capital',
   'Established business owners (car dealers, restaurant owners, salon owners) who have capital deployed — prime property investors',
   '["runs a business (has income stream)","makes large purchases","established presence in target city"]',
   '["jiji_cars","jiji_restaurants","google_maps_kumasi"]',
   '[{"id":"car_dealer_investor","label":"Car Dealer"},{"id":"restaurant_owner_investor","label":"Restaurant Owner"},{"id":"electronics_dealer","label":"Electronics Dealer"}]'),

  (lower(hex(randomblob(16))), 'real_estate_buyer',
   'Active Property Buyer',
   'End-users actively searching for land, apartments, or property to buy or invest in',
   '["actively searching for property","has budget confirmed","location-specific search"]',
   '["lamudi","jiji","meqasa"]',
   '[{"id":"investor_buyer","label":"Property Investor"},{"id":"first_homebuyer","label":"First-Time Home Buyer"},{"id":"speculator","label":"Land Speculator"}]'),

  (lower(hex(randomblob(16))), 'b2b_decision_maker',
   'B2B Decision Maker',
   'Marketing managers, founders, and directors making software/marketing purchasing decisions',
   '["decision making authority","budget holder","technology decision maker"]',
   '["linkedin","jiji","google_maps"]',
   '[{"id":"marketing_manager","label":"Marketing Manager"},{"id":"small_business_owner","label":"Small Business Owner"},{"id":"freelancer_consultant","label":"Freelancer"}]'),

  (lower(hex(randomblob(16))), 'ecommerce_business',
   'E-Commerce / Online Business',
   'Online sellers, shop owners, and e-commerce operators on Jiji, Facebook Marketplace, or Instagram',
   '["runs an online business","has a shop or presence","advertises products"]',
   '["jiji","facebook_marketplace","instagram"]',
   '[{"id":"online_seller","label":"Online Seller"},{"id":"retail_shop_owner","label":"Shop Owner"},{"id":"freelancer","label":"Freelancer"}]');