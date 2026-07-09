# APPLIED 2026-07-09

**Database:** Turso (sendflow-tedymiles.aws-ap-northeast-1.turso.io)
**Applied by:** Clio (via direct libsql execute; no formal Prisma migrate workflow)
**Migration file:** `prisma/migrations/20260709_add_segments/migration.sql`

## What it does

1. Creates the `Segment` table:
   - `id` (cuid), `userId` (FK to User, cascade delete)
   - `name` (display name, unique per user), `tag` (the tag string to match)
   - `color` (optional hex), `description` (optional free text)
   - `matchType` (default `'ANY'`, reserved for v2 multi-rule within a segment)
   - `createdAt`, `updatedAt` timestamps

2. Indexes:
   - `Segment_userId_idx` for fast per-user listing
   - `Segment_userId_name_key` unique constraint preventing duplicate names per user

3. Seeds default segments for every existing user:
   - `phones-segment` (tag: `phones-segment`, color: blue)
   - `cars-segment` (tag: `cars-segment`, color: amber)

## Why we didn't use `prisma migrate dev`

`prisma migrate` requires the local Prisma client to be in sync with the
schema. The local `prisma/schema.prisma` on this Mac has 11 columns that
the live Turso DB does not have (drift, pre-existing — see schema-reconciliation
note in 02-Pending-Work.md). Running `prisma migrate dev` would try to drop
those columns. We use the direct libsql execute path to apply only the new
additive migration, no destructive changes.

## Idempotency

Safe to re-run:
- `CREATE TABLE IF NOT EXISTS` — no-op if table exists
- `CREATE INDEX IF NOT EXISTS` — no-op if index exists
- Seed inserts use `WHERE NOT EXISTS` subqueries — re-running won't duplicate

To verify idempotency: re-run the migration and confirm the Segment row
count for each user stays the same.

## Evidence

After applying, the following query should return 2 rows per user (one for each seed):
```sql
SELECT name, tag, color FROM Segment WHERE userId = (SELECT id FROM User WHERE email = 'don@sendflow.test') ORDER BY name;
```

Expected output:
```
cars-segment|cars-segment|#F59E0B
phones-segment|phones-segment|#3B82F6
```

**Actual result 2026-07-09:** 196 segments seeded across 98 users (2 per user). User count is 98 (not 5 as a prior session audit mistakenly reported — that was a `LIMIT 20` artifact).

## How it was applied

Not via `prisma migrate dev` (which would have tried to drop columns the local Prisma doesn't know about). Instead, a one-shot Node script at `scripts/apply-20260709-segments.js` reads the migration SQL, splits on top-level `;`, and runs each statement via `@libsql/client`. Idempotent error handling for `duplicate column` and `already exists`.
