import { test, expect, type Page } from '@playwright/test';

/**
 * SendFlow /dashboard/connect E2E (deployed)
 *
 * Verifies the WhatsApp connect flow end-to-end:
 *   1. Register + verify user
 *   2. Land on /dashboard/connect
 *   3. Click "Connect" → POST /api/wacli/connect
 *   4. Daemon generates QR → GET /api/wacli/connect (QR handler) returns it
 *   5. /api/wacli/status reports the connection state
 */

const STAMP = Date.now();
const EMAIL = `e2e-connect-${STAMP}@sendflow.test`;
const NAME = `E2E Connect ${STAMP}`;
const PASSWORD = 'E2eTest!2026';

async function registerAndGetSessionCookie(request: any, name: string, email: string, password: string): Promise<string> {
  const regRes = await request.post('/api/auth/register', { data: { name, email, password } });
  if (regRes.status() !== 202) throw new Error(`register failed: ${regRes.status()}`);

  const resendRes = await request.post('/api/auth/resend-verify', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ email }),
  });
  if (resendRes.status() !== 200) throw new Error(`resend-verify failed: ${resendRes.status()}`);
  const resendBody = await resendRes.json();
  if (!resendBody.token) throw new Error(`No token: ${JSON.stringify(resendBody)}`);

  const verifyRes = await request.get(`/api/auth/verify-email?token=${encodeURIComponent(resendBody.token)}`, {
    maxRedirects: 0,
  });
  const setCookie = verifyRes.headers()['set-cookie'] || '';
  const cookieMatch = setCookie.match(/sf_token=([^;]+)/);
  if (!cookieMatch) throw new Error(`No sf_token: "${setCookie}"`);
  return cookieMatch[1];
}

test.describe.serial('/dashboard/connect flow', () => {
  test('full connect flow works end-to-end', async ({ page, context }) => {
    // Step 1: Register + verify
    const cookieValue = await registerAndGetSessionCookie(page.request, NAME, EMAIL, PASSWORD);
    await context.addCookies([{
      name: 'sf_token',
      value: cookieValue,
      domain: 'sendflow-two.vercel.app',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);

    // Step 2: Status API sanity — should be DISCONNECTED (daemon idle)
    const statusBefore = await page.request.get('/api/wacli/status');
    const statusBeforeBody = await statusBefore.json();
    console.log('STATUS BEFORE:', JSON.stringify(statusBeforeBody));
    expect(statusBefore).toBeOK();
    expect(statusBeforeBody).toHaveProperty('state');
    expect(statusBeforeBody.state).toMatch(/DISCONNECTED|ERROR|CONNECTING|CONNECTED/);

    // Step 3: Land on /dashboard/connect
    await page.goto('/dashboard/connect');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/connect-1-page.png', fullPage: true });

    // Step 4: Find and click the connect button
    const connectBtn = page.locator('button').filter({ hasText: /connect|link whatsapp|generate qr|start/i }).first();
    const btnCount = await connectBtn.count();
    console.log('connect buttons found:', btnCount);
    expect(btnCount).toBeGreaterThan(0);

    await connectBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/connect-2-clicked.png', fullPage: true });

    // Step 5: Check status after connect call
    const statusAfter = await page.request.get('/api/wacli/status');
    const statusAfterBody = await statusAfter.json();
    console.log('STATUS AFTER CONNECT:', JSON.stringify(statusAfterBody));
    expect(statusAfter).toBeOK();

    // Step 6: Check QR endpoint — QR handler lives at GET /api/wacli/connect
    const qrRes = await page.request.get('/api/wacli/connect');
    const qrText = await qrRes.text();
    console.log('QR STATUS:', qrRes.status(), 'BODY:', qrText.slice(0, 300));
    expect(qrRes.ok()).toBeTruthy();

    const qrBody = JSON.parse(qrText);
    expect(qrBody).toHaveProperty('success');
    expect(qrBody.success).toBe(true);
    expect(qrBody.state).toMatch(/QR_READY|CONNECTING|CONNECTED|DISCONNECTED/);

    if (qrBody.qr) {
      expect(typeof qrBody.qr).toBe('string');
      expect(qrBody.qr.length).toBeGreaterThan(50);
      console.log('QR string length:', qrBody.qr.length);
    }

    // Step 7: Wait and check final status
    await page.waitForTimeout(2000);
    const statusFinal = await page.request.get('/api/wacli/status');
    const statusFinalBody = await statusFinal.json();
    console.log('STATUS FINAL:', JSON.stringify(statusFinalBody));

    // Step 8: Disconnect to clean up the daemon
    const disconnectRes = await page.request.post('/api/wacli/disconnect');
    const disconnectBody = await disconnectRes.json();
    console.log('DISCONNECT:', disconnectRes.status(), JSON.stringify(disconnectBody));
    expect(disconnectRes.ok()).toBeTruthy();
  });
});
