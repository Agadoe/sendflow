# Migration 20260602_add_role_and_client_portal — APPLIED to production

**Date applied:** 2026-06-05 07:34 GMT
**Applied to:** `libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io`
**Applied by:** Clio (manual, via libsql client)
**Triggered by:** Production 500 errors on /api/auth/login and /api/auth/register
**Root cause:** Prisma schema had `role` field on User model; production DB was missing the column.

## Verification
- Before: `User columns: id, email, name, phone, plan, passwordHash, emailVerified, createdAt, updatedAt, isOwner`
- After:  `User columns: id, email, name, phone, plan, passwordHash, emailVerified, createdAt, updatedAt, isOwner, role`
- User count preserved: 8 → 8
- POST /api/auth/register returns 200 (was 500)
- POST /api/auth/login returns 200 (was 500)
- GET /api/auth/me with valid cookie returns user with role=OWNER
- GET /client-portal with cookie returns 200 (not 307 redirect)

## Idempotency
The migration is idempotent — safe to re-run.
