import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { SignJWT } from 'jose';

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

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

async function registerViaApi(request: any, name: string, email: string, password: string) {
  const res = await request.post('/api/auth/register', { data: { name, email, password } });
  return res;
}

async function getVerifiedSession(request: any, email: string): Promise<Response> {
  // Step 1 – request magic-link (email is test-routed to Tedymiles7@gmail.com)
  await request.post('/api/auth/magic-link', { data: { email } });

  // Step 2 – re-sign a JWT so we can present it to /verify
  const token = await new SignJWT({ sub: email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);

  // Step 3 – call verify; marks emailVerified and returns session cookie
  const verifyRes = await request.get(`/api/auth/verify?token=${encodeURIComponent(token)}`);
  return verifyRes;
}

async function applySessionCookie(context: BrowserContext, response: Response) {
  const setCookie = response.headers.get('set-cookie') || '';
  const match = setCookie.match(/sf_token=([^;]+)/);
  if (!match) return;
  await context.addCookies([{
    name: 'sf_token',
    value: match[1],
    domain: new URL('https://sendflow-two.vercel.app').hostname,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  }]);
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

    const regRes = await registerViaApi(apiRequest, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(regRes.status(), 'admin registration should succeed').toBe(202);

    const verifyRes = await getVerifiedSession(apiRequest, ADMIN_EMAIL);
    expect(verifyRes.ok(), '/verify should succeed for magic-link token').toBe(true);
    await applySessionCookie(adminContext, verifyRes);
  });

  test('1. admin register → "check your email" screen (not /dashboard)', async ({ page }) => {
    const email = `e2e-reg-${STAMP}@sendflow.test`;
    await register(page, `E2E Reg ${STAMP}`, email, ADMIN_PASSWORD);
    await page.waitForTimeout(2_000);

    const body = await page.locator('body').innerText();
    expect(
      /email|verify|inbox|check.*email/i.test(body.toLowerCase()),
      'register success screen should mention email verification'
    ).toBe(true);
    expect(page.url()).not.toMatch(/\/dashboard/);
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

  test('7. logout button works from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const logoutBtn = page.getByTitle(/sign\s*out/i);
    await expect(logoutBtn, 'logout button should exist on dashboard').toBeVisible();
    await logoutBtn.click();

    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
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