export const meta = {
  name: 'sendflow-security-audit',
  description: 'Comprehensive security audit of SendFlow with OpenClaw feedback loop',
  phases: [
    { title: 'Fan-Out Audit', detail: 'Parallel agents audit auth, data isolation, public surface, and payment infra' },
    { title: 'OpenClaw Feedback', detail: 'Run OpenClaw security audit and adversarial verification of findings' },
    { title: 'Synthesis', detail: 'Combine all findings into a prioritized report' },
  ],
};

// Phase 1: Parallel fan-out audits
phase('Fan-Out Audit');
const findings = await parallel([
  () => agent(`
You are auditing the AUTHENTICATION & SESSION SECURITY of a Next.js WhatsApp SaaS called SendFlow.
Read these files in order, then report your findings as structured JSON:
1. /Users/admin/sendflow/src/middleware.ts
2. /Users/admin/sendflow/src/lib/auth.ts
3. /Users/admin/sendflow/src/lib/jwt.ts
4. /Users/admin/sendflow/src/lib/cookie.ts
5. /Users/admin/sendflow/src/lib/rate-limit.ts
6. /Users/admin/sendflow/src/lib/validation.ts
7. /Users/admin/sendflow/src/app/api/auth/login/route.ts
8. /Users/admin/sendflow/src/app/api/auth/register/route.ts
9. /Users/admin/sendflow/src/app/api/auth/forgot-password/route.ts
10. /Users/admin/sendflow/src/app/api/auth/reset-password/route.ts
11. /Users/admin/sendflow/src/app/api/auth/verify-email/route.ts
12. /Users/admin/sendflow/src/app/api/auth/magic-link/route.ts
13. /Users/admin/sendflow/src/app/api/client-auth/login/route.ts
14. /Users/admin/sendflow/src/app/api/client-auth/register/route.ts
15. /Users/admin/sendflow/src/app/api/auth/me/route.ts

Look for: auth bypass, session fixation, JWT secret handling, cookie security (SameSite/Secure/HttpOnly), rate limit bypass, horizontal escalation between admin and client portals, email enumeration, token replay, missing validation. Be ruthless.

Return ONLY a JSON array of findings. Each finding must have: { "severity": "CRITICAL|HIGH|MEDIUM|LOW", "category": "auth", "title": "...", "file": "...", "line": "...", "detail": "...", "exploit": "...", "fix": "..." }
`, { label: 'auth-audit', schema: { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, category: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' }, line: { type: 'string' }, detail: { type: 'string' }, exploit: { type: 'string' }, fix: { type: 'string' } }, required: ['severity','title','file'] } } }, required: ['findings'] } }),

  () => agent(`
You are auditing DATA ISOLATION & ACCESS CONTROL of SendFlow.
Read these files in order, then report your findings as structured JSON:
1. /Users/admin/sendflow/prisma/schema.prisma
2. /Users/admin/sendflow/src/lib/plans.ts
3. /Users/admin/sendflow/src/app/api/campaigns/route.ts
4. /Users/admin/sendflow/src/app/api/campaigns/send/route.ts
5. /Users/admin/sendflow/src/app/api/campaigns/bulk-send/route.ts
6. /Users/admin/sendflow/src/app/api/contacts/route.ts
7. /Users/admin/sendflow/src/app/api/contacts/[id]/route.ts
8. /Users/admin/sendflow/src/app/api/leads/route.ts
9. /Users/admin/sendflow/src/app/api/leads/[id]/route.ts
10. /Users/admin/sendflow/src/app/api/settings/team/route.ts
11. /Users/admin/sendflow/src/app/api/clients/route.ts
12. /Users/admin/sendflow/src/app/api/messages/route.ts
13. /Users/admin/sendflow/src/app/api/links/route.ts

Look for: IDOR (can User A access User B's campaigns/contacts/leads?), missing userId filters in Prisma queries, plan enforcement bypass (can FREE users access paid features?), race conditions on limit checks, soft delete issues, cascade delete risks, missing FK constraints. Be ruthless.

Return ONLY a JSON array of findings. Each finding must have: { "severity": "CRITICAL|HIGH|MEDIUM|LOW", "category": "isolation", "title": "...", "file": "...", "line": "...", "detail": "...", "exploit": "...", "fix": "..." }
`, { label: 'isolation-audit', schema: { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, category: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' }, line: { type: 'string' }, detail: { type: 'string' }, exploit: { type: 'string' }, fix: { type: 'string' } }, required: ['severity','title','file'] } } }, required: ['findings'] } }),

  () => agent(`
You are auditing the PUBLIC SURFACE & INJECTION VECTORS of SendFlow.
Read these files in order, then report your findings as structured JSON:
1. /Users/admin/sendflow/src/app/api/forms/[id]/submit/route.ts
2. /Users/admin/sendflow/src/app/api/webhooks/n8n/leads/route.ts
3. /Users/admin/sendflow/src/app/api/webhooks/openclaw/message/route.ts
4. /Users/admin/sendflow/src/app/api/lead-push/route.ts
5. /Users/admin/sendflow/src/app/api/kgc-contact/route.ts
6. /Users/admin/sendflow/src/app/api/wacli/connect/route.ts
7. /Users/admin/sendflow/src/app/api/wacli/send/route.ts
8. /Users/admin/sendflow/src/app/api/wacli/status/route.ts
9. /Users/admin/sendflow/src/app/api/cron/fetch-mail/route.ts
10. /Users/admin/sendflow/src/app/api/cron/process/route.ts
11. /Users/admin/sendflow/src/app/api/waitlist/route.ts
12. /Users/admin/sendflow/src/app/api/analytics/route.ts

Look for: unauthenticated endpoints that expose/modify data, SQL injection via raw queries, NoSQL injection in Prisma, XSS via unescaped rendering, SSRF via outbound fetch, path traversal, CSRF on state-changing endpoints, webhook replay attacks, missing signature validation on webhooks, open redirect. Be ruthless.

Return ONLY a JSON array of findings. Each finding must have: { "severity": "CRITICAL|HIGH|MEDIUM|LOW", "category": "public", "title": "...", "file": "...", "line": "...", "detail": "...", "exploit": "...", "fix": "..." }
`, { label: 'public-audit', schema: { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, category: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' }, line: { type: 'string' }, detail: { type: 'string' }, exploit: { type: 'string' }, fix: { type: 'string' } }, required: ['severity','title','file'] } } }, required: ['findings'] } }),

  () => agent(`
You are auditing PAYMENT, BUSINESS LOGIC & INFRASTRUCTURE of SendFlow.
Read these files in order, then report your findings as structured JSON:
1. /Users/admin/sendflow/src/app/api/paystack/webhook/route.ts
2. /Users/admin/sendflow/src/app/api/paystack/initialize/route.ts
3. /Users/admin/sendflow/src/app/api/paystack/verify/[ref]/route.ts
4. /Users/admin/sendflow/src/app/api/paystack/plans/route.ts
5. /Users/admin/sendflow/src/app/api/drip/route.ts
6. /Users/admin/sendflow/src/app/api/drip/[id]/route.ts
7. /Users/admin/sendflow/src/app/api/sms/route.ts
8. /Users/admin/sendflow/src/app/api/sms/send/route.ts
9. /Users/admin/sendflow/src/app/api/email/route.ts
10. /Users/admin/sendflow/src/app/api/email/campaigns/route.ts
11. /Users/admin/sendflow/next.config.js
12. /Users/admin/sendflow/package.json

Look for: Paystack webhook idempotency failures, replay attacks, price tampering, plan upgrade/downgrade race conditions, missing signature verification, free-tier abuse of paid features, insecure dependencies (check package.json for known vulnerabilities), missing security headers in next.config.js, SSR misconfigurations. Be ruthless.

Return ONLY a JSON array of findings. Each finding must have: { "severity": "CRITICAL|HIGH|MEDIUM|LOW", "category": "payment", "title": "...", "file": "...", "line": "...", "detail": "...", "exploit": "...", "fix": "..." }
`, { label: 'payment-audit', schema: { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, category: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' }, line: { type: 'string' }, detail: { type: 'string' }, exploit: { type: 'string' }, fix: { type: 'string' } }, required: ['severity','title','file'] } } }, required: ['findings'] } }),
]);

log(`Phase 1 complete. Auth: ${findings[0]?.findings?.length || 0}, Isolation: ${findings[1]?.findings?.length || 0}, Public: ${findings[2]?.findings?.length || 0}, Payment: ${findings[3]?.findings?.length || 0}`);

// Flatten and dedupe by title
const allFindings = findings.filter(Boolean).flatMap(f => f.findings || []);
const seen = new Set();
const uniqueFindings = allFindings.filter(f => {
  const key = `${f.file}:${f.title}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Phase 2: OpenClaw feedback + adversarial verification
phase('OpenClaw Feedback');
const ocAudit = await agent(`
Run OpenClaw's security audit by executing: /usr/local/bin/openclaw security audit --json
Read the JSON output. Also check the OpenClaw gateway health with /usr/local/bin/openclaw health.

Then analyze these existing findings from the SendFlow codebase audit and tell me:
1. Which findings are likely real vs false positives?
2. What additional attack vectors does OpenClaw config reveal?
3. Any infrastructure-level risks (gateway exposure, proxy misconfig, etc.)?

Existing findings summary:
${uniqueFindings.map(f => `- [${f.severity}] ${f.title} (${f.file})`).join('\n')}

Return ONLY JSON: { "openclawFindings": [{ "severity": "...", "title": "...", "detail": "..." }], "verdicts": [{ "title": "...", "verdict": "confirmed|refuted|uncertain", "reason": "..." }] }
`, { label: 'openclaw-feedback', schema: { type: 'object', properties: { openclawFindings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, title: { type: 'string' }, detail: { type: 'string' } }, required: ['severity','title'] } }, verdicts: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, verdict: { type: 'string' }, reason: { type: 'string' } }, required: ['title','verdict'] } } }, required: ['openclawFindings','verdicts'] } });

// Phase 3: Synthesis
phase('Synthesis');
const report = await agent(`
You are a senior security engineer synthesizing a final audit report for SendFlow.

Combine these inputs into a single structured report:

1. CODE AUDIT FINDINGS (${uniqueFindings.length} total):
${uniqueFindings.map(f => `- [${f.severity}] ${f.category}: ${f.title} (${f.file})\n  Detail: ${f.detail}\n  Exploit: ${f.exploit}\n  Fix: ${f.fix}`).join('\n\n')}

2. OPENCLAW INFRASTRUCTURE FINDINGS:
${(ocAudit.openclawFindings || []).map(f => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n')}

3. VERDICTS (refuted findings to remove):
${(ocAudit.verdicts || []).filter(v => v.verdict === 'refuted').map(v => `- ${v.title}: ${v.reason}`).join('\n')}

Produce the final report in this exact format:

## 🔴 Critical (Fix Before Launch)
[Numbered list with file:line references]

## 🟠 High (Fix This Week)
[Numbered list]

## 🟡 Medium (Fix Soon)
[Numbered list]

## 🟢 Low / Nice-to-Have
[Numbered list]

## 📋 Quick Wins Checklist
[5-10 easiest high-impact fixes, ordered by effort/reward]

## 🏗 Architecture Concerns
[Structural issues that may bite at scale]

Be concise. No generic advice. Every finding must reference specific code.
`, { label: 'synthesis' });

return { report, rawFindings: uniqueFindings, openclaw: ocAudit };
