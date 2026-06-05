# Migration 20260605_add_waitlist_wantscall — APPLIED to production

**Date applied:** 2026-06-05 09:31 GMT
**Applied to:** `libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io`
**Applied by:** Clio (manual, via libsql client)
**Triggered by:** Intermittent production health audit — discovered 500s on `/api/waitlist`
**Root cause:** Prisma schema had `wantsCall` field on `Waitlist` model; production DB was missing the column.

## Verification
- Before: `Waitlist columns: id, email, name, businessType, phone, createdAt`
- After:  `Waitlist columns: id, email, name, businessType, phone, createdAt, wantsCall`
- All existing rows defaulted to `wantsCall: false`
- POST /api/waitlist signup: 200 (was 500)
- GET /api/waitlist (dashboard): 200 (was 500)
- Mailchimp + Telegram fan-out: 0 failed
- Test signup: `audit-fixed-2026-06-05@baahe.org` recorded with `wantsCall: true`

## Cross-DB audit performed
After applying, I ran a full audit comparing all 20 Prisma models against
production DB columns. **No other missing columns detected.** Waitlist.wantsCall
was the only gap. The DB and Prisma schema are now in sync for all production
tables.

## Idempotency
The migration is idempotent — safe to re-run. SQLite `ALTER TABLE ADD COLUMN`
returns an error if the column exists, which is fine for one-shot runs.

## Files
- `prisma/migrations/20260605_add_waitlist_wantscall/migration.sql` (this migration)
