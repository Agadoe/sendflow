# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> SendFlow auth — deployed >> 1. admin register → "check your email" screen (not /dashboard)
- Location: tests/e2e/auth.spec.ts:97:7

# Error details

```
Error: /verify should succeed for magic-link token

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1   | import { test, expect, type Page, type BrowserContext } from '@playwright/test';
  2   | import { SignJWT } from 'jose';
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
  27  | const JWT_SECRET = new TextEncoder().encode(
  28  |   process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
  29  | );
  30  | 
  31  | async function registerViaApi(request: any, name: string, email: string, password: string) {
  32  |   const res = await request.post('/api/auth/register', { data: { name, email, password } });
  33  |   return res;
  34  | }
  35  | 
  36  | async function getVerifiedSession(request: any, email: string): Promise<Response> {
  37  |   // Step 1 – request magic-link (email is test-routed to Tedymiles7@gmail.com)
  38  |   await request.post('/api/auth/magic-link', { data: { email } });
  39  | 
  40  |   // Step 2 – re-sign a JWT so we can present it to /verify
  41  |   const token = await new SignJWT({ sub: email })
  42  |     .setProtectedHeader({ alg: 'HS256' })
  43  |     .setIssuedAt()
  44  |     .setExpirationTime('15m')
  45  |     .sign(JWT_SECRET);
  46  | 
  47  |   // Step 3 – call verify; marks emailVerified and returns session cookie
  48  |   const verifyRes = await request.get(`/api/auth/verify?token=${encodeURIComponent(token)}`);
  49  |   return verifyRes;
  50  | }
  51  | 
  52  | async function applySessionCookie(context: BrowserContext, response: Response) {
  53  |   const setCookie = response.headers.get('set-cookie') || '';
  54  |   const match = setCookie.match(/sf_token=([^;]+)/);
  55  |   if (!match) return;
  56  |   await context.addCookies([{
  57  |     name: 'sf_token',
  58  |     value: match[1],
  59  |     domain: new URL('https://sendflow-two.vercel.app').hostname,
  60  |     path: '/',
  61  |     httpOnly: true,
  62  |     secure: true,
  63  |     sameSite: 'Lax',
  64  |   }]);
  65  | }
  66  | 
  67  | async function register(page: Page, name: string, email: string, password: string) {
  68  |   await page.goto('/register');
  69  |   await page.getByPlaceholder('Esther Mensah').fill(name);
  70  |   await page.getByPlaceholder('you@example.com').fill(email);
  71  |   await page.locator('input[type="password"]').fill(password);
  72  |   await page.getByRole('button', { name: /create account/i }).click();
  73  | }
  74  | 
  75  | async function login(page: Page, email: string, password: string) {
  76  |   await page.goto('/login');
  77  |   await page.locator('input[type="email"]').fill(email);
  78  |   await page.locator('input[type="password"]').fill(password);
  79  |   await page.getByRole('button', { name: /sign in/i }).click();
  80  | }
  81  | 
  82  | test.describe.serial('SendFlow auth — deployed', () => {
  83  |   let adminContext: BrowserContext;
  84  | 
  85  |   test.beforeAll(async ({ browser }) => {
  86  |     adminContext = await browser.newContext();
  87  |     const apiRequest = adminContext.request;
  88  | 
  89  |     const regRes = await registerViaApi(apiRequest, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);
  90  |     expect(regRes.status(), 'admin registration should succeed').toBe(202);
  91  | 
  92  |     const verifyRes = await getVerifiedSession(apiRequest, ADMIN_EMAIL);
> 93  |     expect(verifyRes.ok(), '/verify should succeed for magic-link token').toBe(true);
      |                                                                           ^ Error: /verify should succeed for magic-link token
  94  |     await applySessionCookie(adminContext, verifyRes);
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
  146 |     await page.waitForURL(/sendflow-two\.vercel\.app\/dashboard/, { timeout: 10_000 });
  147 |     expect(page.url()).not.toContain('evil.com');
  148 |   });
  149 | 
  150 |   test('6. client portal rejects an admin account (role guard)', async ({ page }) => {
  151 |     await page.goto('/client-portal/login');
  152 |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  153 |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  154 |     await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
  155 | 
  156 |     await page.waitForTimeout(2_000);
  157 |     const url = page.url();
  158 |     const body = await page.locator('body').innerText();
  159 | 
  160 |     const hasError = /admin|role|not allowed|client only/i.test(body);
  161 |     const stillOnLogin = /client-portal\/login/.test(url);
  162 |     expect(hasError || stillOnLogin, 'admin should not be granted a client session').toBe(true);
  163 |   });
  164 | 
  165 |   test('7. logout button works from the dashboard', async ({ page }) => {
  166 |     await page.goto('/dashboard');
  167 |     await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  168 | 
  169 |     const logoutBtn = page.getByTitle(/sign\s*out/i);
  170 |     await expect(logoutBtn, 'logout button should exist on dashboard').toBeVisible();
  171 |     await logoutBtn.click();
  172 | 
  173 |     await page.goto('/dashboard');
  174 |     await page.waitForURL(/\/login/, { timeout: 5_000 });
  175 |     await expect(page).toHaveURL(/\/login/);
  176 |   });
  177 | 
  178 |   test('8. contact form posts successfully and persists', async ({ request }) => {
  179 |     const res = await request.post('/api/contact', {
  180 |       data: {
  181 |         name: 'E2E Probe',
  182 |         email: `e2e-${STAMP}@example.com`,
  183 |         message: `Smoke test from Clio E2E. STAMP=${STAMP}. Please ignore.`,
  184 |       },
  185 |     });
  186 |     expect(res.status()).toBe(200);
  187 |     const body = await res.json();
  188 |     expect(body.success).toBe(true);
  189 |     expect(typeof body.id).toBe('string');
  190 |     expect(body.emailSent).toBe(true);
  191 |   });
  192 | 
  193 |   test('9. contact form rejects empty submissions', async ({ request }) => {
```