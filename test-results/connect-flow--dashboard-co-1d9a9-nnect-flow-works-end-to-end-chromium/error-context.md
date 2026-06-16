# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: connect-flow.spec.ts >> /dashboard/connect flow >> full connect flow works end-to-end
- Location: tests/e2e/connect-flow.spec.ts:45:7

# Error details

```
Error: expect(received).toMatch(expected)

Expected pattern: /DISCONNECTED|ERROR|CONNECTING|CONNECTED/
Received string:  "daemon_error"
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * SendFlow /dashboard/connect E2E (deployed)
  5   |  *
  6   |  * Verifies the WhatsApp connect flow end-to-end:
  7   |  *   1. Register + verify user
  8   |  *   2. Land on /dashboard/connect
  9   |  *   3. Click "Connect" → POST /api/wacli/connect
  10  |  *   4. Daemon generates QR → /api/wacli/qr returns it
  11  |  *   5. /api/wacli/status reports the connection state
  12  |  *
  13  |  * IMPORTANT: This will trigger a real Baileys socket on the VPS daemon.
  14  |  * The daemon's connection state will change from "idle" to "connecting"
  15  |  * for the duration of the test. This is expected and desired.
  16  |  */
  17  | 
  18  | const STAMP = Date.now();
  19  | const EMAIL = `e2e-connect-${STAMP}@sendflow.test`;
  20  | const NAME = `E2E Connect ${STAMP}`;
  21  | const PASSWORD = 'E2eTest!2026';
  22  | 
  23  | async function registerAndGetSessionCookie(request: any, name: string, email: string, password: string): Promise<string> {
  24  |   const regRes = await request.post('/api/auth/register', { data: { name, email, password } });
  25  |   if (regRes.status() !== 202) throw new Error(`register failed: ${regRes.status()}`);
  26  | 
  27  |   const resendRes = await request.post('/api/auth/resend-verify', {
  28  |     headers: { 'Content-Type': 'application/json' },
  29  |     data: JSON.stringify({ email }),
  30  |   });
  31  |   if (resendRes.status() !== 200) throw new Error(`resend-verify failed: ${resendRes.status()}`);
  32  |   const resendBody = await resendRes.json();
  33  |   if (!resendBody.token) throw new Error(`No token: ${JSON.stringify(resendBody)}`);
  34  | 
  35  |   const verifyRes = await request.get(`/api/auth/verify-email?token=${encodeURIComponent(resendBody.token)}`, {
  36  |     maxRedirects: 0,
  37  |   });
  38  |   const setCookie = verifyRes.headers()['set-cookie'] || '';
  39  |   const cookieMatch = setCookie.match(/sf_token=([^;]+)/);
  40  |   if (!cookieMatch) throw new Error(`No sf_token: "${setCookie}"`);
  41  |   return cookieMatch[1];
  42  | }
  43  | 
  44  | test.describe.serial('/dashboard/connect flow', () => {
  45  |   test('full connect flow works end-to-end', async ({ page, context }) => {
  46  |     // Step 1: Register + verify
  47  |     const cookieValue = await registerAndGetSessionCookie(page.request, NAME, EMAIL, PASSWORD);
  48  |     await context.addCookies([{
  49  |       name: 'sf_token',
  50  |       value: cookieValue,
  51  |       domain: 'sendflow-two.vercel.app',
  52  |       path: '/',
  53  |       httpOnly: true,
  54  |       secure: true,
  55  |       sameSite: 'Lax',
  56  |     }]);
  57  | 
  58  |     // Step 2: Status API sanity (should return DISCONNECTED initially)
  59  |     const statusBefore = await page.request.get('/api/wacli/status');
  60  |     const statusBeforeBody = await statusBefore.json();
  61  |     console.log('STATUS BEFORE:', JSON.stringify(statusBeforeBody));
  62  |     expect(statusBeforeBody).toHaveProperty('state');
> 63  |     expect(statusBeforeBody.state).toMatch(/DISCONNECTED|ERROR|CONNECTING|CONNECTED/);
      |                                    ^ Error: expect(received).toMatch(expected)
  64  | 
  65  |     // Step 3: Land on /dashboard/connect
  66  |     await page.goto('/dashboard/connect');
  67  |     await page.waitForLoadState('networkidle');
  68  |     await page.screenshot({ path: '/tmp/connect-1-page.png', fullPage: true });
  69  | 
  70  |     // Step 4: Find and click the connect button
  71  |     const connectBtn = page.locator('button').filter({ hasText: /connect|link whatsapp|generate qr|start/i }).first();
  72  |     const btnCount = await connectBtn.count();
  73  |     console.log('connect buttons found:', btnCount);
  74  |     expect(btnCount).toBeGreaterThan(0);
  75  | 
  76  |     await connectBtn.click();
  77  |     await page.waitForTimeout(500); // give the API a moment
  78  |     await page.screenshot({ path: '/tmp/connect-2-clicked.png', fullPage: true });
  79  | 
  80  |     // Step 5: Check status after connect call
  81  |     const statusAfter = await page.request.get('/api/wacli/status');
  82  |     const statusAfterBody = await statusAfter.json();
  83  |     console.log('STATUS AFTER CONNECT:', JSON.stringify(statusAfterBody));
  84  | 
  85  |     // Step 6: Check QR endpoint
  86  |     const qrRes = await page.request.get('/api/wacli/qr');
  87  |     const qrBody = await qrRes.json();
  88  |     console.log('QR ENDPOINT:', qrRes.status(), JSON.stringify(qrBody).slice(0, 300));
  89  | 
  90  |     // The QR should either be: waiting (daemon still spinning up),
  91  |     // pending with a qr string, or already_connected.
  92  |     expect(qrBody).toHaveProperty('status');
  93  |     expect(['waiting', 'pending', 'already_connected']).toContain(qrBody.status);
  94  | 
  95  |     // If we got a QR, validate it's a string
  96  |     if (qrBody.status === 'pending') {
  97  |       expect(typeof qrBody.qr).toBe('string');
  98  |       expect(qrBody.qr.length).toBeGreaterThan(50);
  99  |       console.log('QR string length:', qrBody.qr.length);
  100 |     }
  101 | 
  102 |     // Wait a bit and check status one more time to see if state changed
  103 |     await page.waitForTimeout(3000);
  104 |     const statusFinal = await page.request.get('/api/wacli/status');
  105 |     const statusFinalBody = await statusFinal.json();
  106 |     console.log('STATUS FINAL:', JSON.stringify(statusFinalBody));
  107 | 
  108 |     // Step 7: Disconnect to clean up
  109 |     const disconnectRes = await page.request.post('/api/wacli/disconnect');
  110 |     const disconnectBody = await disconnectRes.json();
  111 |     console.log('DISCONNECT:', disconnectRes.status(), JSON.stringify(disconnectBody));
  112 |     expect(disconnectRes.ok()).toBeTruthy();
  113 |   });
  114 | });
  115 | 
```