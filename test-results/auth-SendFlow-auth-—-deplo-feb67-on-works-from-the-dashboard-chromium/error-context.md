# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> SendFlow auth — deployed >> 7. logout button works from the dashboard
- Location: tests/e2e/auth.spec.ts:159:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "https://sendflow-two.vercel.app/dashboard/pipeline"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e6]
        - generic [ref=e9]:
          - generic [ref=e10]: SendFlow
          - generic [ref=e11]: Business Dashboard
      - navigation [ref=e12]:
        - link "Dashboard" [ref=e13] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e14]
          - text: Dashboard
        - link "Drip Queue" [ref=e16] [cursor=pointer]:
          - /url: /dashboard/drip-queue
          - img [ref=e17]
          - text: Drip Queue
        - link "Settings" [ref=e19] [cursor=pointer]:
          - /url: /dashboard/settings
          - img [ref=e20]
          - text: Settings
        - link "Forms" [ref=e23] [cursor=pointer]:
          - /url: /dashboard/forms
          - img [ref=e24]
          - text: Forms
        - link "Pipeline" [ref=e26] [cursor=pointer]:
          - /url: /dashboard/pipeline
          - img [ref=e27]
          - text: Pipeline
        - link "Analytics" [ref=e29] [cursor=pointer]:
          - /url: /dashboard/analytics
          - img [ref=e30]
          - text: Analytics
        - link "Campaigns" [ref=e32] [cursor=pointer]:
          - /url: /dashboard/campaigns
          - img [ref=e33]
          - text: Campaigns
        - link "Contacts" [ref=e35] [cursor=pointer]:
          - /url: /dashboard/contacts
          - img [ref=e36]
          - text: Contacts
        - link "Drip Queue" [ref=e38] [cursor=pointer]:
          - /url: /dashboard/drip-queue
          - img [ref=e39]
          - text: Drip Queue
        - link "Connect WhatsApp" [ref=e41] [cursor=pointer]:
          - /url: /dashboard/connect
          - img [ref=e42]
          - text: Connect WhatsApp
        - link "Waitlist" [ref=e44] [cursor=pointer]:
          - /url: /dashboard/waitlist
          - img [ref=e45]
          - text: Waitlist
        - link "Inbox" [ref=e47] [cursor=pointer]:
          - /url: /dashboard/inbox
          - img [ref=e48]
          - text: Inbox
        - link "Messages" [ref=e50] [cursor=pointer]:
          - /url: /dashboard/messages
          - img [ref=e51]
          - text: Messages
        - link "Clients" [ref=e53] [cursor=pointer]:
          - /url: /dashboard/clients
          - img [ref=e54]
          - text: Clients
      - generic [ref=e57]:
        - generic [ref=e58]: E
        - generic [ref=e59]:
          - generic [ref=e60]: E2E Admin 1781399686656
          - generic [ref=e61]: Free Plan
        - button "Sign out" [ref=e62] [cursor=pointer]:
          - img [ref=e63]
    - generic [ref=e65]:
      - banner [ref=e66]:
        - generic [ref=e67]: Dashboard
        - generic [ref=e68]:
          - generic [ref=e69]: Free Plan
          - link "← Landing" [ref=e70] [cursor=pointer]:
            - /url: /
      - main [ref=e71]:
        - generic [ref=e72]:
          - generic [ref=e73]:
            - generic [ref=e74]:
              - heading "Pipeline" [level=1] [ref=e75]
              - paragraph [ref=e76]: 0 leads
            - button "Add Lead" [ref=e77] [cursor=pointer]:
              - img [ref=e78]
              - text: Add Lead
          - generic [ref=e80]:
            - generic [ref=e81]:
              - generic [ref=e83]:
                - generic [ref=e84]: New
                - generic [ref=e85]: "0"
              - generic [ref=e87]: Drop leads here
            - generic [ref=e88]:
              - generic [ref=e90]:
                - generic [ref=e91]: Contacted
                - generic [ref=e92]: "0"
              - generic [ref=e94]: Drop leads here
            - generic [ref=e95]:
              - generic [ref=e97]:
                - generic [ref=e98]: Qualified
                - generic [ref=e99]: "0"
              - generic [ref=e101]: Drop leads here
            - generic [ref=e102]:
              - generic [ref=e104]:
                - generic [ref=e105]: Converted
                - generic [ref=e106]: "0"
              - generic [ref=e108]: Drop leads here
            - generic [ref=e109]:
              - generic [ref=e111]:
                - generic [ref=e112]: Lost
                - generic [ref=e113]: "0"
              - generic [ref=e115]: Drop leads here
  - alert [ref=e116]
```

# Test source

```ts
  70  |   let adminContext: BrowserContext;
  71  | 
  72  |   test.beforeAll(async ({ browser }) => {
  73  |     adminContext = await browser.newContext();
  74  |     const apiRequest = adminContext.request;
  75  |     const cookieValue = await registerAndGetSessionCookie(apiRequest, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD);
  76  |     await adminContext.addCookies([{
  77  |       name: 'sf_token',
  78  |       value: cookieValue,
  79  |       domain: new URL('https://sendflow-two.vercel.app').hostname,
  80  |       path: '/',
  81  |       httpOnly: true,
  82  |       secure: true,
  83  |       sameSite: 'Lax',
  84  |     }]);
  85  |   });
  86  | 
  87  |   test('1. unverified email → login blocked with needsVerification=true', async ({ page }) => {
  88  |     // Register a fresh email — should NOT get a session
  89  |     const email = `e2e-unverified-${STAMP}@sendflow.test`;
  90  |     const regRes = await page.request.post('/api/auth/register', {
  91  |       data: { name: `Unverified ${STAMP}`, email, password: ADMIN_PASSWORD },
  92  |     });
  93  |     expect(regRes.status()).toBe(202);
  94  | 
  95  |     // Try to login — should be blocked with 403 + needsVerification
  96  |     const loginRes = await page.request.post('/api/auth/login', {
  97  |       data: { email, password: ADMIN_PASSWORD },
  98  |     });
  99  |     expect(loginRes.status()).toBe(403);
  100 |     const body = await loginRes.json();
  101 |     expect(body.needsVerification).toBe(true);
  102 |   });
  103 | 
  104 |   test('2. re-login with the same credentials works', async () => {
  105 |     const page2 = await adminContext.newPage();
  106 |     await page2.goto('/dashboard');
  107 |     await page2.waitForURL(/\/dashboard/, { timeout: 10_000 });
  108 | 
  109 |     const cookies = await adminContext.cookies();
  110 |     const session = cookies.find((c) => c.name === 'sf_token');
  111 |     expect(session, 'sf_token should be set').toBeDefined();
  112 |     expect(session!.value.length).toBeGreaterThan(20);
  113 |     await page2.close();
  114 |   });
  115 | 
  116 |   test('3. ?redirect= is honored for same-origin paths', async () => {
  117 |     const page3 = await adminContext.newPage();
  118 |     await page3.goto('/login?redirect=/dashboard/messages');
  119 |     await page3.waitForURL(/\/dashboard\/messages/, { timeout: 10_000 });
  120 |     await expect(page3).toHaveURL(/\/dashboard\/messages/);
  121 |     await page3.close();
  122 |   });
  123 | 
  124 |   test('4. open-redirect guard: external URL is rejected', async ({ page }) => {
  125 |     await page.goto('/login?redirect=https://evil.com/phish');
  126 |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  127 |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  128 |     await page.getByRole('button', { name: /sign in/i }).click();
  129 | 
  130 |     await page.waitForURL(/sendflow-two\.vercel\.app\/dashboard/, { timeout: 10_000 });
  131 |     expect(page.url()).not.toContain('evil.com');
  132 |   });
  133 | 
  134 |   test('5. open-redirect guard: protocol-relative //evil.com rejected', async ({ page }) => {
  135 |     await page.goto('/login?redirect=//evil.com/phish');
  136 |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  137 |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  138 |     await page.getByRole('button', { name: /sign in/i }).click();
  139 | 
  140 |     await page.waitForURL(/sendflow-two\.vercel\.app\/dashboard/, { timeout: 10_000 });
  141 |     expect(page.url()).not.toContain('evil.com');
  142 |   });
  143 | 
  144 |   test('6. client portal rejects an admin account (role guard)', async ({ page }) => {
  145 |     await page.goto('/client-portal/login');
  146 |     await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  147 |     await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  148 |     await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
  149 | 
  150 |     await page.waitForTimeout(2_000);
  151 |     const url = page.url();
  152 |     const body = await page.locator('body').innerText();
  153 | 
  154 |     const hasError = /admin|role|not allowed|client only/i.test(body);
  155 |     const stillOnLogin = /client-portal\/login/.test(url);
  156 |     expect(hasError || stillOnLogin, 'admin should not be granted a client session').toBe(true);
  157 |   });
  158 | 
  159 |   test('7. logout button works from the dashboard', async () => {
  160 |     const p = await adminContext.newPage();
  161 |     await p.goto('/dashboard');
  162 |     await p.waitForLoadState('load');
  163 |     await p.waitForURL(/\/dashboard/, { timeout: 15_000 });
  164 | 
  165 |     const logoutBtn = p.getByTitle(/sign\s*out/i);
  166 |     await expect(logoutBtn, 'logout button should be visible').toBeVisible({ timeout: 5_000 });
  167 |     await logoutBtn.click();
  168 | 
  169 |     await p.goto('/dashboard');
> 170 |     await p.waitForURL(/\/login/, { timeout: 10_000 });
      |             ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  171 |     await p.close();
  172 |   });
  173 | 
  174 |   test('8. contact form posts successfully and persists', async ({ request }) => {
  175 |     const res = await request.post('/api/contact', {
  176 |       data: {
  177 |         name: 'E2E Probe',
  178 |         email: `e2e-${STAMP}@example.com`,
  179 |         message: `Smoke test from Clio E2E. STAMP=${STAMP}. Please ignore.`,
  180 |       },
  181 |     });
  182 |     expect(res.status()).toBe(200);
  183 |     const body = await res.json();
  184 |     expect(body.success).toBe(true);
  185 |     expect(typeof body.id).toBe('string');
  186 |     expect(body.emailSent).toBe(true);
  187 |   });
  188 | 
  189 |   test('9. contact form rejects empty submissions', async ({ request }) => {
  190 |     const res = await request.post('/api/contact', {
  191 |       data: { name: '', email: '', message: '' },
  192 |     });
  193 |     expect(res.status()).toBe(400);
  194 |   });
  195 | 
  196 |   test('10. contact page UI renders and accepts input', async ({ page }) => {
  197 |     await page.goto('/contact');
  198 |     await expect(page.locator('h1, h2').first()).toBeVisible();
  199 |     await expect(page.locator('input[name="name"], input[placeholder*="name" i]').first()).toBeVisible();
  200 |     await expect(page.locator('input[type="email"]').first()).toBeVisible();
  201 |     await expect(page.locator('textarea').first()).toBeVisible();
  202 |   });
  203 | });
```