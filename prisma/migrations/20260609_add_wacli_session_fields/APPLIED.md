# Migration 20260609_add_wacli_session_fields — APPLIED to production

**Date applied:** 2026-06-09 09:00 GMT
**Applied to:** `libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io`
**Applied by:** Clio (manual, via @libsql/client Node lib)
**Triggered by:** Cherry-pick of pre-auth-fix-stash-2026-06-08 + missing wacli fields referenced by /api/wacli/* routes

## Schema delta
- Before: 11 User columns (id, email, name, phone, plan, passwordHash, emailVerified, createdAt, updatedAt, isOwner, role)
- After:  16 User columns (+ wacliSessionId, wacliStatus, wacliPhone, wacliLastConnectedAt, wacliQrCode)

## Idempotency
ALTER TABLE statements are NOT idempotent on SQLite — re-running will fail with "duplicate column". 
If you need to re-run, drop the columns first or use this script:
```sql
ALTER TABLE "User" DROP COLUMN "wacliSessionId";
ALTER TABLE "User" DROP COLUMN "wacliStatus";
ALTER TABLE "User" DROP COLUMN "wacliPhone";
ALTER TABLE "User" DROP COLUMN "wacliLastConnectedAt";
ALTER TABLE "User" DROP COLUMN "wacliQrCode";
```

## Why this exists
The /api/wacli/connect, /send, and /status routes write to user.wacliStatus etc. They were merged
in commit 12f45285 ("fix(wacli): multi-tenant auth + schema fields for wacli session"). The schema
fields and migration were both required for those routes to work in production.
