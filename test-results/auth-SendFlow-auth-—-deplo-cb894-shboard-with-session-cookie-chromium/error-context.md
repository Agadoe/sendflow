# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> SendFlow auth — deployed >> 1. admin register → /dashboard with session cookie
- Location: tests/e2e/auth.spec.ts:43:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e6]
      - heading "Create your account" [level=1] [ref=e9]
      - paragraph [ref=e10]: Start your free SendFlow trial — no credit card needed
    - generic [ref=e11]:
      - generic [ref=e12]:
        - img [ref=e14]
        - heading "Check your email" [level=2] [ref=e16]
        - paragraph [ref=e17]: We sent a verification link to
        - paragraph [ref=e18]: e2e-admin-1781397382033@sendflow.test
        - paragraph [ref=e19]: Click the link in the email to activate your account. The link expires in 1 hour.
        - button "Use a different email address" [ref=e20] [cursor=pointer]
      - generic [ref=e21]:
        - text: Already have an account?
        - link "Sign in" [ref=e22] [cursor=pointer]:
          - /url: /login
  - alert [ref=e23]
```

# Test source

```ts
  1   | import { test, expect, type Page, type BrowserContext } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * SendFlow Auth E2E (deployed)
  5   |  *
  6   |  * Verifies the auth flow as a real user would experience it.
  7   |  * Each test creates a fresh user with a unique email so the suite is repeatable.
  8   |  *
  9   |  * Coverage:
  10  |  *   1. Admin register → /dashboard + sf_token cookie (HttpOnly, SameSite=Lax)
  11  |  *   2. Admin re-login with same credentials
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
  27  | async function register(page: Page, name: string, email: string, password: string) {
  28  |   await page.goto('/register');
  29  |   await page.getByPlaceholder('Esther Mensah').fill(name);
  30  |   await page.getByPlaceholder('you@example.com').fill(email);
  31  |   await page.locator('input[type="password"]').fill(password);
  32  |   await page.getByRole('button', { name: /create account/i }).click();
  33  | }
  34  | 
  35  | async function login(page: Page, email: string, password: string) {
  36  |   await page.goto('/login');
  37  |   await page.locator('input[type="email"]').fill(email);
  38  |   await page.locator('input[type="password"]').fill(password);
  39  |   await page.getByRole('button', { name: /sign in/i }).click();
  40  | }
  41  | 
  42  | test.describe.serial('SendFlow auth — deployed', () => {
  43  |   test('1. admin register → /dashboard with session cookie', async ({ page, context }) => {
  44  |     await register(page, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);
> 45  |     await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  46  | 
  47  |     const cookies = await context.cookies();
  48  |     const session = cookies.find((c) => c.name === 'sf_token');
  49  |     expect(session, 'sf_token cookie should be set').toBeDefined();
  50  |     expect(session!.httpOnly, 'cookie should be HttpOnly').toBe(true);
  51  |     expect(session!.sameSite, 'cookie should be SameSite=Lax').toBe('Lax');
  52  | 
  53  |     await expect(page).toHaveURL(/\/dashboard\/?$/);
  54  |     const body = await page.locator('body').innerText();
  55  |     expect(body.length).toBeGreaterThan(50);
  56  |     expect(body.toLowerCase()).not.toContain('application error');
  57  |   });
  58  | 
  59  |   test('2. re-login with the same credentials works', async ({ page, context }) => {
  60  |     await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  61  |     await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  62  | 
  63  |     const cookies = await context.cookies();
  64  |     const session = cookies.find((c) => c.name === 'sf_token');
  65  |     expect(session, 'sf_token should be set after re-login').toBeDefined();
  66  |     expect(session!.value.length).toBeGreaterThan(20); // JWTs are long
  67  |   });
  68  | 
  69  |   test('3. ?redirect= is honored for same-origin paths', async ({ page }) => {
  70  |     await page.goto('/login?redirect=/dashboard/messages');
  71  |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  72  |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  73  |     await page.getByRole('button', { name: /sign in/i }).click();
  74  | 
  75  |     await page.waitForURL(/\/dashboard\/messages/, { timeout: 10_000 });
  76  |     await expect(page).toHaveURL(/\/dashboard\/messages/);
  77  |   });
  78  | 
  79  |   test('4. open-redirect guard: external URL is rejected', async ({ page }) => {
  80  |     await page.goto('/login?redirect=https://evil.com/phish');
  81  |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  82  |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  83  |     await page.getByRole('button', { name: /sign in/i }).click();
  84  | 
  85  |     // Must land on the safe fallback (/dashboard), NOT evil.com
  86  |     await page.waitForURL(/sendflow-two\.vercel\.app\/dashboard/, { timeout: 10_000 });
  87  |     expect(page.url()).not.toContain('evil.com');
  88  |   });
  89  | 
  90  |   test('5. open-redirect guard: protocol-relative //evil.com rejected', async ({ page }) => {
  91  |     await page.goto('/login?redirect=//evil.com/phish');
  92  |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  93  |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  94  |     await page.getByRole('button', { name: /sign in/i }).click();
  95  | 
  96  |     await page.waitForURL(/sendflow-two\.vercel\.app\/dashboard/, { timeout: 10_000 });
  97  |     expect(page.url()).not.toContain('evil.com');
  98  |   });
  99  | 
  100 |   test('6. client portal rejects an admin account (role guard)', async ({ page, context }) => {
  101 |     // First, log in as admin in a clean context
  102 |     await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  103 |     await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  104 | 
  105 |     // Now try to use those credentials on the client portal
  106 |     await page.goto('/client-portal/login');
  107 |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  108 |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  109 |     await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
  110 | 
  111 |     await page.waitForTimeout(2_000);
  112 |     const url = page.url();
  113 |     const body = await page.locator('body').innerText();
  114 | 
  115 |     // Should NOT be granted a client dashboard
  116 |     expect(url).not.toContain('/client-portal/dashboard');
  117 |     expect(url).not.toContain('/dashboard'); // not the admin dashboard either
  118 |     // Should be back on login with an error, or show an error inline
  119 |     const hasError = /admin|role|not allowed|invalid|client only|invalid credentials/i.test(body);
  120 |     const stillOnLogin = /client-portal\/login/.test(url);
  121 |     expect(hasError || stillOnLogin, 'admin should not be granted a client session').toBe(true);
  122 |   });
  123 | 
  124 |   test('7. logout button works from the dashboard', async ({ page, context }) => {
  125 |     // Fresh login
  126 |     await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  127 |     await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  128 | 
  129 |     // Logout button is icon-only with title="Sign out"
  130 |     const logoutBtn = page.getByTitle(/sign\s*out/i);
  131 |     await expect(logoutBtn, 'logout button should exist on dashboard').toBeVisible();
  132 |     await logoutBtn.click();
  133 | 
  134 |     // After logout, visiting /dashboard should bounce us to /login
  135 |     await page.goto('/dashboard');
  136 |     await page.waitForURL(/\/login/, { timeout: 5_000 });
  137 |     await expect(page).toHaveURL(/\/login/);
  138 |   });
  139 | 
  140 |   test('8. contact form posts successfully and persists', async ({ request }) => {
  141 |     const res = await request.post('/api/contact', {
  142 |       data: {
  143 |         name: 'E2E Probe',
  144 |         email: `e2e-${STAMP}@example.com`,
  145 |         message: `Smoke test from Clio E2E. STAMP=${STAMP}. Please ignore.`,
```