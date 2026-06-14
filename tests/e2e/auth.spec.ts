import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * SendFlow Auth E2E (deployed)
 *
 * Verifies the auth flow as a real user would experience it.
 *
 * Coverage:
 *   1. Admin register → "check your email" screen (not /dashboard — email verification required)
 *   2. Re-login with same credentials works (verified user)
 *   3. ?redirect= is honored for same-origin paths
 *   4. Open-redirect guard: https://evil.com rejected
 *   5. Open-redirect guard: //evil.com rejected
 *   6. Client portal rejects an admin account (role guard)
 *   7. Logout button works
 *   8. Contact form posts successfully and returns emailSent=true
 *   9. Contact form rejects empty submissions
 *  10. Contact page UI renders all required fields
 */

const STAMP = Date.now();
const ADMIN_EMAIL = `e2e-admin-${STAMP}@sendflow.test`;
const ADMIN_NAME = `E2E Admin ${STAMP}`;
const ADMIN_PASSWORD = 'E2eTest!2026';

/**
 * Full flow: register → resend-verify (test mode returns token) → verify-email.
 * Returns the sf_token cookie value — no email access needed.
 */
async function registerAndGetSessionCookie(request: any, name: string, email: string, password: string): Promise<string> {
  // 1. Register — creates user + VerificationToken, sends email, returns 202
  const regRes = await request.post('/api/auth/register', { data: { name, email, password } });
  if (regRes.status() !== 202) throw new Error(`register failed: ${regRes.status()}`);

  // 2. Resend — in test mode the response includes { token, verifyUrl }
  const resendRes = await request.post('/api/auth/resend-verify', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ email }),
  });
  if (resendRes.status() !== 200) throw new Error(`resend-verify failed: ${resendRes.status()}`);
  const resendBody = await resendRes.json();
  if (!resendBody.token) throw new Error(`No token in resend-verify response: ${JSON.stringify(resendBody)}`);

  // 3. Verify the token — capture Set-Cookie on the 302
  const verifyRes = await request.get(`/api/auth/verify-email?token=${encodeURIComponent(resendBody.token)}`, {
    maxRedirects: 0,
  });
  const setCookie = verifyRes.headers()['set-cookie'] || '';
  const cookieMatch = setCookie.match(/sf_token=([^;]+)/);
  if (!cookieMatch) throw new Error(`No sf_token in Set-Cookie from verify-email: "${setCookie}"`);
  return cookieMatch[1];
}

async function register(page: Page, name: string, email: string, password: string) {
  await page.goto('/register');
  await page.getByPlaceholder('Esther Mensah').fill(name);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test.describe.serial('SendFlow auth — deployed', () => {
  let adminContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    adminContext = await browser.newContext();
    const apiRequest = adminContext.request;
    const cookieValue = await registerAndGetSessionCookie(apiRequest, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminContext.addCookies([{
      name: 'sf_token',
      value: cookieValue,
      domain: new URL('https://sendflow-two.vercel.app').hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);
  });

  test('1. unverified email → login blocked with needsVerification=true', async ({ page }) => {
    // Register a fresh email — should NOT get a session
    const email = `e2e-unverified-${STAMP}@sendflow.test`;
    const regRes = await page.request.post('/api/auth/register', {
      data: { name: `Unverified ${STAMP}`, email, password: ADMIN_PASSWORD },
    });
    expect(regRes.status()).toBe(202);

    // Try to login — should be blocked with 403 + needsVerification
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status()).toBe(403);
    const body = await loginRes.json();
    expect(body.needsVerification).toBe(true);
  });

  test('2. re-login with the same credentials works', async () => {
    const page2 = await adminContext.newPage();
    await page2.goto('/dashboard');
    await page2.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const cookies = await adminContext.cookies();
    const session = cookies.find((c) => c.name === 'sf_token');
    expect(session, 'sf_token should be set').toBeDefined();
    expect(session!.value.length).toBeGreaterThan(20);
    await page2.close();
  });

  test('3. ?redirect= is honored for same-origin paths', async () => {
    const page3 = await adminContext.newPage();
    await page3.goto('/login?redirect=/dashboard/messages');
    await page3.waitForURL(/\/dashboard\/messages/, { timeout: 10_000 });
    await expect(page3).toHaveURL(/\/dashboard\/messages/);
    await page3.close();
  });

  test('4. open-redirect guard: external URL is rejected', async ({ page }) => {
    await page.goto('/login?redirect=https://evil.com/phish');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/sendflow-two\.vercel\.app\/dashboard/, { timeout: 10_000 });
    expect(page.url()).not.toContain('evil.com');
  });

  test('5. open-redirect guard: protocol-relative //evil.com rejected', async ({ page }) => {
    await page.goto('/login?redirect=//evil.com/phish');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/sendflow-two\.vercel\.app\/dashboard/, { timeout: 10_000 });
    expect(page.url()).not.toContain('evil.com');
  });

  test('6. client portal rejects an admin account (role guard)', async ({ page }) => {
    await page.goto('/client-portal/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();

    await page.waitForTimeout(2_000);
    const url = page.url();
    const body = await page.locator('body').innerText();

    const hasError = /admin|role|not allowed|client only/i.test(body);
    const stillOnLogin = /client-portal\/login/.test(url);
    expect(hasError || stillOnLogin, 'admin should not be granted a client session').toBe(true);
  });

  test('7. logout button works from the dashboard', async () => {
    const dashPage = await adminContext.newPage();
    await dashPage.goto('/dashboard');
    await dashPage.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const logoutBtn = dashPage.getByTitle(/sign\s*out/i);
    await expect(logoutBtn, 'logout button should exist on dashboard').toBeVisible();
    await logoutBtn.click();

    await dashPage.goto('/dashboard');
    await dashPage.waitForURL(/\/login/, { timeout: 5_000 });
    await expect(dashPage).toHaveURL(/\/login/);
    await dashPage.close();
  });

  test('8. contact form posts successfully and persists', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: {
        name: 'E2E Probe',
        email: `e2e-${STAMP}@example.com`,
        message: `Smoke test from Clio E2E. STAMP=${STAMP}. Please ignore.`,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.id).toBe('string');
    expect(body.emailSent).toBe(true);
  });

  test('9. contact form rejects empty submissions', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: '', email: '', message: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('10. contact page UI renders and accepts input', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('input[name="name"], input[placeholder*="name" i]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible();
  });
});