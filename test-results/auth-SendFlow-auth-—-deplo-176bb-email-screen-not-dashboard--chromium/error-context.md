# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> SendFlow auth — deployed >> 1. admin register → "check your email" screen (not /dashboard)
- Location: tests/e2e/auth.spec.ts:97:7

# Error details

```
Error: No VerificationToken found for e2e-admin-1781398811914@sendflow.test — register may have failed
```

# Test source

```ts
  1   | import { test, expect, type Page, type BrowserContext } from '@playwright/test';
  2   | import { PrismaClient } from '@prisma/client';
  3   | 
  4   | /**
  5   |  * SendFlow Auth E2E (deployed)
  6   |  *
  7   |  * Verifies the auth flow as a real user would experience it.
  8   |  *
  9   |  * Coverage:
  10  |  *   1. Admin register → "check your email" screen (not /dashboard — email verification required)
  11  |  *   2. Re-login with same credentials works (verified user)
  12  |  *   3. ?redirect= is honored for same-origin paths
  13  |  *   4. Open-redirect guard: https://evil.com rejected
  14  |  *   5. Open-redirect guard: //evil.com rejected
  15  |  *   6. Client portal rejects an admin account (role guard)
  16  |  *   7. Logout button works
  17  |  *   8. Contact form posts successfully and returns emailSent=true
  18  |  *   9. Contact form rejects empty submissions
  19  |  *  10. Contact page UI renders all required fields
  20  |  */
  21  | 
  22  | const STAMP = Date.now();
  23  | const ADMIN_EMAIL = `e2e-admin-${STAMP}@sendflow.test`;
  24  | const ADMIN_NAME = `E2E Admin ${STAMP}`;
  25  | const ADMIN_PASSWORD = 'E2eTest!2026';
  26  | 
  27  | const prisma = new PrismaClient();
  28  | 
  29  | async function registerViaApi(request: any, name: string, email: string, password: string) {
  30  |   const res = await request.post('/api/auth/register', { data: { name, email, password } });
  31  |   return res;
  32  | }
  33  | 
  34  | /**
  35  |  * Obtain a verified session for the given email by reading the VerificationToken
  36  |  * that was created by /register, then calling /verify-email to consume it.
  37  |  */
  38  | async function getVerifiedSession(request: any, email: string): Promise<{ status: number; headers: Headers }> {
  39  |   // Wait for DB write, then read the token created by register
  40  |   await new Promise(r => setTimeout(r, 500));
  41  |   const record = await prisma.verificationToken.findFirst({
  42  |     where: { identifier: email },
  43  |     orderBy: { expires: 'desc' },
  44  |   });
> 45  |   if (!record) throw new Error(`No VerificationToken found for ${email} — register may have failed`);
      |                      ^ Error: No VerificationToken found for e2e-admin-1781398811914@sendflow.test — register may have failed
  46  | 
  47  |   // Call verify-email (the VerificationToken endpoint, separate from magic-link JWT /verify)
  48  |   const verifyRes = await request.get(`/api/auth/verify-email?token=${record.token}`, {
  49  |     maxRedirects: 0,  // capture Set-Cookie on the 302 before following it
  50  |   });
  51  |   return { status: verifyRes.status(), headers: verifyRes.headers() };
  52  | }
  53  | 
  54  | async function applySessionCookie(context: BrowserContext, response: { status: number; headers: Headers }) {
  55  |   const setCookie = response.headers.get('set-cookie') || '';
  56  |   const match = setCookie.match(/sf_token=([^;]+)/);
  57  |   if (!match) {
  58  |     console.warn('[applySessionCookie] no sf_token found in Set-Cookie header:', setCookie);
  59  |     return;
  60  |   }
  61  |   await context.addCookies([{
  62  |     name: 'sf_token',
  63  |     value: match[1],
  64  |     domain: new URL('https://sendflow-two.vercel.app').hostname,
  65  |     path: '/',
  66  |     httpOnly: true,
  67  |     secure: true,
  68  |     sameSite: 'Lax',
  69  |   }]);
  70  | }
  71  | 
  72  | async function register(page: Page, name: string, email: string, password: string) {
  73  |   await page.goto('/register');
  74  |   await page.getByPlaceholder('Esther Mensah').fill(name);
  75  |   await page.getByPlaceholder('you@example.com').fill(email);
  76  |   await page.locator('input[type="password"]').fill(password);
  77  |   await page.getByRole('button', { name: /create account/i }).click();
  78  | }
  79  | 
  80  | test.describe.serial('SendFlow auth — deployed', () => {
  81  |   let adminContext: BrowserContext;
  82  | 
  83  |   test.beforeAll(async ({ browser }) => {
  84  |     adminContext = await browser.newContext();
  85  |     const apiRequest = adminContext.request;
  86  | 
  87  |     const regRes = await registerViaApi(apiRequest, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);
  88  |     expect(regRes.status(), 'admin registration should succeed').toBe(202);
  89  | 
  90  |     const verifyRes = await getVerifiedSession(apiRequest, ADMIN_EMAIL);
  91  |     expect([302, 200]).toContain(verifyRes.status(), '/verify-email should return 302 or 200');
  92  |     await applySessionCookie(adminContext, verifyRes);
  93  | 
  94  |     await prisma.$disconnect();
  95  |   });
  96  | 
  97  |   test('1. admin register → "check your email" screen (not /dashboard)', async ({ page }) => {
  98  |     const email = `e2e-reg-${STAMP}@sendflow.test`;
  99  |     await register(page, `E2E Reg ${STAMP}`, email, ADMIN_PASSWORD);
  100 |     await page.waitForTimeout(2_000);
  101 | 
  102 |     const body = await page.locator('body').innerText();
  103 |     expect(
  104 |       /email|verify|inbox|check.*email/i.test(body.toLowerCase()),
  105 |       'register success screen should mention email verification'
  106 |     ).toBe(true);
  107 |     expect(page.url()).not.toMatch(/\/dashboard/);
  108 |   });
  109 | 
  110 |   test('2. re-login with the same credentials works', async () => {
  111 |     const page2 = await adminContext.newPage();
  112 |     await page2.goto('/dashboard');
  113 |     await page2.waitForURL(/\/dashboard/, { timeout: 10_000 });
  114 | 
  115 |     const cookies = await adminContext.cookies();
  116 |     const session = cookies.find((c) => c.name === 'sf_token');
  117 |     expect(session, 'sf_token should be set').toBeDefined();
  118 |     expect(session!.value.length).toBeGreaterThan(20);
  119 |     await page2.close();
  120 |   });
  121 | 
  122 |   test('3. ?redirect= is honored for same-origin paths', async () => {
  123 |     const page3 = await adminContext.newPage();
  124 |     await page3.goto('/login?redirect=/dashboard/messages');
  125 |     await page3.waitForURL(/\/dashboard\/messages/, { timeout: 10_000 });
  126 |     await expect(page3).toHaveURL(/\/dashboard\/messages/);
  127 |     await page3.close();
  128 |   });
  129 | 
  130 |   test('4. open-redirect guard: external URL is rejected', async ({ page }) => {
  131 |     await page.goto('/login?redirect=https://evil.com/phish');
  132 |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  133 |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  134 |     await page.getByRole('button', { name: /sign in/i }).click();
  135 | 
  136 |     await page.waitForURL(/sendflow-two\.vercel\.app\/dashboard/, { timeout: 10_000 });
  137 |     expect(page.url()).not.toContain('evil.com');
  138 |   });
  139 | 
  140 |   test('5. open-redirect guard: protocol-relative //evil.com rejected', async ({ page }) => {
  141 |     await page.goto('/login?redirect=//evil.com/phish');
  142 |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  143 |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  144 |     await page.getByRole('button', { name: /sign in/i }).click();
  145 | 
```