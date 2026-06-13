import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * SendFlow Auth E2E (deployed)
 *
 * Verifies the auth flow as a real user would experience it.
 * Each test creates a fresh user with a unique email so the suite is repeatable.
 *
 * Coverage:
 *   1. Admin register → /dashboard + sf_token cookie (HttpOnly, SameSite=Lax)
 *   2. Admin re-login with same credentials
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
  test('1. admin register → /dashboard with session cookie', async ({ page, context }) => {
    await register(page, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'sf_token');
    expect(session, 'sf_token cookie should be set').toBeDefined();
    expect(session!.httpOnly, 'cookie should be HttpOnly').toBe(true);
    expect(session!.sameSite, 'cookie should be SameSite=Lax').toBe('Lax');

    await expect(page).toHaveURL(/\/dashboard\/?$/);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(50);
    expect(body.toLowerCase()).not.toContain('application error');
  });

  test('2. re-login with the same credentials works', async ({ page, context }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'sf_token');
    expect(session, 'sf_token should be set after re-login').toBeDefined();
    expect(session!.value.length).toBeGreaterThan(20); // JWTs are long
  });

  test('3. ?redirect= is honored for same-origin paths', async ({ page }) => {
    await page.goto('/login?redirect=/dashboard/messages');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/\/dashboard\/messages/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard\/messages/);
  });

  test('4. open-redirect guard: external URL is rejected', async ({ page }) => {
    await page.goto('/login?redirect=https://evil.com/phish');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Must land on the safe fallback (/dashboard), NOT evil.com
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

  test('6. client portal rejects an admin account (role guard)', async ({ page, context }) => {
    // First, log in as admin in a clean context
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Now try to use those credentials on the client portal
    await page.goto('/client-portal/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();

    await page.waitForTimeout(2_000);
    const url = page.url();
    const body = await page.locator('body').innerText();

    // Should NOT be granted a client dashboard
    expect(url).not.toContain('/client-portal/dashboard');
    expect(url).not.toContain('/dashboard'); // not the admin dashboard either
    // Should be back on login with an error, or show an error inline
    const hasError = /admin|role|not allowed|invalid|client only|invalid credentials/i.test(body);
    const stillOnLogin = /client-portal\/login/.test(url);
    expect(hasError || stillOnLogin, 'admin should not be granted a client session').toBe(true);
  });

  test('7. logout button works from the dashboard', async ({ page, context }) => {
    // Fresh login
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Logout button is icon-only with title="Sign out"
    const logoutBtn = page.getByTitle(/sign\s*out/i);
    await expect(logoutBtn, 'logout button should exist on dashboard').toBeVisible();
    await logoutBtn.click();

    // After logout, visiting /dashboard should bounce us to /login
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
    // SMTP is wired up — should report success
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
    const nameField = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    const emailField = page.locator('input[type="email"]').first();
    const messageField = page.locator('textarea').first();
    await expect(nameField).toBeVisible();
    await expect(emailField).toBeVisible();
    await expect(messageField).toBeVisible();
  });
});
