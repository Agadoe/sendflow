# SendFlow Build Loop

You are running an **autonomous build loop** for **SendFlow**, a WhatsApp SaaS for e-commerce
sellers. The product is live at **https://sendflow-two.vercel.app** on the
`clio/audit-and-fix` branch. You are the only engineer; you wake fresh every iteration.
Your only persistent memory is the status file below.

**Source of truth (read FIRST, every iteration, no exceptions):**
`/Users/admin/whatsapp-saas/SENDFLOW_STATUS.md`

**Working directory:** `/Users/admin/whatsapp-saas/`

---

## The end goal (what "done" means)

SendFlow is shippable as a paid product. **Paystack live keys will be added by Don
manually as the final step — your job is to get everything else to the point where he
can drop the keys in and it just works.**

The order matters:

1. **Email verification** — sign-up sends a verify link, login gated until verified
2. **Forgot password** — token-based reset, expires in 1h
3. **LeadOps integration** — qualified leads from LeadOps HERALD pipeline deep-link into
   SendFlow sign-up with `?ref=leadops&utm_source=leadops&utm_campaign={campaign_id}`,
   attribution captured in DB, visible in dashboard. This is what drives Pro plan sales,
   so it must be measurable end-to-end.
4. **Pro plan feature surface** — contacts cap, campaigns/month, sender slots. Free vs
   Pro must be enforced in the API, not just the UI.
5. **Paystack integration code** — server-side checkout init, webhook handler, plan
   upgrade on `charge.success`, idempotency, signature verification. **STOP HERE** —
   wait for Don to add live keys.
6. **Full audit pass** — Playwright green, every route 200, status file matches reality,
   last commit pushed.

---

## The loop protocol (do this every iteration)

1. **READ** `SENDFLOW_STATUS.md`. Trust it. Do not start work that is already done.
2. **PICK** the highest-priority item in "Open work" that has no blocker.
3. **DO** it. Smallest verifiable increment. **Commit at the end of every green step.**
4. **VERIFY** — never claim "done" without evidence:
   - Code change → run the test, paste output to the status file
   - Endpoint → `curl` it, paste the response code + body excerpt
   - UI change → Playwright spec + screenshot
   - Deploy → `npx vercel --prod` and curl the live URL
5. **UPDATE** the status file:
   - Move completed items to "Verified working" with timestamp + commit hash + evidence
   - Add new TODOs you discovered to "Open work" with priority
   - Note blockers explicitly in "Blocked / needs Don"
6. **AUDIT** — every 3rd iteration, do a full audit:
   - `npx playwright test` → capture results
   - `curl` every route, log status codes
   - Cross-check status file claims against actual code (`grep`, `ls`, `cat package.json`)
   - Fix any drift between the file and reality, commit the fix
7. **EXIT** when **all** of these are true:
   - All five work items above are in "Verified working" with evidence
   - Paystack integration is code-complete with env-var slot documented for Don
   - `SENDFLOW_STATUS.md` "Open work" section is empty
   - Last commit is pushed to `origin/clio/audit-and-fix`
   - Playwright suite is green (10/10 minimum)

---

## Hard rules (these will save you from breaking the build)

- **Every external send needs Don's explicit OK first.** No emails, no Paystack charges,
  no public posts. The build loop is internal work.
- **Test emails go to `Tedymiles7@gmail.com`** — every test, no exceptions.
- **Mailchimp free tier rule:** audiences >1k → send immediately, never schedule ahead
  more than 1 day. (N/A to this loop unless waitlist email is added.)
- **Do NOT pop the 14 stashed changes** from `git stash list` without flagging Don first.
  They are unrelated and have been triaged away.
- **Use `git add -A && git commit -m "..."` and `git push` after every green step.**
  Git log is your secondary memory.
- **Time-box each iteration at 15 minutes of work.** If a step is bigger, break it down.
- **If you are stuck 2 iterations on the same blocker, write it to "Blocked" and stop.**
  Do not thrash. Surface it for Don.
- **Auth is sacred.** Don't re-implement auth in layouts that wrap public pages — let
  `middleware.ts` be the single source of truth (lesson from the 2026-06-09 infinite-307
  loop bug).
- **Cookie + JWT pattern is set:** `sf_token`, HttpOnly, SameSite=Lax, 7d admin / 30d
  client. Don't change it without reason.

---

## Tools available

- bash, read, write, edit (Claude Code defaults)
- Playwright (`npx playwright test`, config at `tests/e2e/playwright.config.ts`)
- Vercel CLI (`npx vercel --prod`, `npx vercel env ls`)
- Git
- curl
- Node 20+, pnpm or npm (check `package.json`)

---

## Reference context (baked in — don't re-research)

- **Stack:** Next.js 14 (app router), TypeScript, Prisma + Postgres (Neon), NextAuth-style
  JWT cookies, Tailwind, shadcn/ui, Vercel hosting.
- **Live URL:** https://sendflow-two.vercel.app
- **Auth state (2026-06-08 / 2026-06-09, verified):** register, login, logout, role guards,
  `?redirect=` open-redirect hardening, client portal login, contact form. 10/10
  Playwright tests passing. Last commit `0c669983`.
- **Outstanding from MEMORY.md (verify on first iteration):**
  - Email verification — not built
  - Forgot password — not built
  - Paystack — code TBD, keys TBD
  - /api/contact — built, `emailSent: true` verified
  - wacli daemon — needs WhatsApp QR scan to reconnect (out of scope for this loop)
- **Don's contact for blockers:** Telegram `Tedymiles` / `Tedymiles7@gmail.com`.

---

## Status file template (start with this, evolve it)

```markdown
# SendFlow Build Status

**Last updated:** <ISO>
**Last commit:** <hash> on clio/audit-and-fix
**Last deploy:** sendflow-two.vercel.app at <ISO>
**Iteration count:** <n>

## Verified working (with evidence)
- [x] Auth: register/login/logout/role guards — 2026-06-09, commit 0c669983, 10/10 Playwright
- [x] /api/contact — verified <ISO>, `emailSent: true`
- [ ] Email verification — not built
- [ ] Forgot password — not built
- [ ] LeadOps attribution — not built
- [ ] Pro plan enforcement — not built
- [ ] Paystack code — not built

## Open work (priority order)
1. <item> — <why it matters> — <estimate>
2. ...

## Blocked / needs Don
- <item> — <what I tried> — <what I need>

## Discovered during build
- <item> — <why it matters>

## Last audit: <ISO>
- Playwright: X/Y passing
- Routes hit: /, /login, /register, /client-portal, /api/contact → all 200/expected
- Drift found: <none|items>
```

---

## Spawn command (for Clio or Don)

```bash
# One-shot iteration (Claude Code via OpenClaw)
sessions_spawn \
  --label "sendflow-build-loop" \
  --runtime acp \
  --agentId claude-code \
  --mode run \
  --task "$(cat /Users/admin/whatsapp-saas/SENDFLOW_BUILD_LOOP.md)" \
  --cwd /Users/admin/whatsapp-saas \
  --timeout 1800

# Or, to run multiple iterations back-to-back, re-spawn after each one finishes.
# The status file carries state between runs.
```

To run as a true continuous loop, wrap it in a shell loop:

```bash
while :; do
  sessions_spawn --label "sendflow-build-iter-$(date +%s)" --runtime acp \
    --agentId claude-code --mode run \
    --task "$(cat /Users/admin/whatsapp-saas/SENDFLOW_BUILD_LOOP.md)" \
    --cwd /Users/admin/whatsapp-saas --timeout 1800
  grep -q "^## Open work" /Users/admin/whatsapp-saas/SENDFLOW_STATUS.md || break
  sleep 5
done
```

This re-spawns Claude Code, lets it read the status file, do one iteration's work, write
the new state, and exit. The while loop checks if "Open work" is empty and breaks when done.
