import type { APIResponse } from '@playwright/test';

/**
 * Shared test helpers for SendFlow e2e tests.
 *
 * Reusable across auth.spec.ts, connect-flow.spec.ts, and any future e2e tests.
 */

/**
 * Register a new user + verify email + return the sf_token cookie value.
 *
 * Handles 429 rate-limiting automatically by honoring the `Retry-After` header.
 * If `Retry-After` is missing, falls back to a 30s wait.
 *
 * Usage:
 *   const cookie = await registerAndGetSessionCookie(request, name, email, password);
 *   await context.addCookies([{ name: 'sf_token', value: cookie, ... }]);
 */
export async function registerAndGetSessionCookie(
  request: APIResponse['request'],
  name: string,
  email: string,
  password: string,
  maxRetries = 3,
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Step 1: Register (returns 202 on success, 429 on rate limit)
    const regRes = await registerWithRetry(request, name, email, password, attempt);
    if (regRes.status() !== 202) {
      throw new Error(`register failed: ${regRes.status()}`);
    }

    // Step 2: Resend verify (test mode returns { token, verifyUrl })
    const resendRes = await request.post('/api/auth/resend-verify', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ email }),
    });
    if (resendRes.status() === 429) {
      const retryAfter = parseRetryAfter(resendRes) ?? 30;
      console.log(`[registerAndGetSessionCookie] resend-verify 429; waiting ${retryAfter}s before retry (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (resendRes.status() !== 200) throw new Error(`resend-verify failed: ${resendRes.status()}`);
    const resendBody = await resendRes.json();
    if (!resendBody.token) throw new Error(`No token: ${JSON.stringify(resendBody)}`);

    // Step 3: Verify the token (302 with Set-Cookie)
    const verifyRes = await request.get(`/api/auth/verify-email?token=${encodeURIComponent(resendBody.token)}`, {
      maxRedirects: 0,
    });
    if (verifyRes.status() !== 302) throw new Error(`verify-email returned ${verifyRes.status()}`);

    const setCookie = verifyRes.headers()['set-cookie'] || '';
    const cookieMatch = setCookie.match(/sf_token=([^;]+)/);
    if (!cookieMatch) throw new Error(`No sf_token: "${setCookie}"`);
    return cookieMatch[1];
  }

  throw new Error(`registerAndGetSessionCookie exhausted ${maxRetries} retries on ${email}`);
}

/**
 * Register with automatic 429 retry.
 */
async function registerWithRetry(
  request: APIResponse['request'],
  name: string,
  email: string,
  password: string,
  attempt: number,
  maxRetries = 3,
): Promise<APIResponse> {
  const res = await request.post('/api/auth/register', { data: { name, email, password } });
  if (res.status() !== 429) return res;

  if (attempt >= maxRetries) {
    throw new Error(`register 429 (gave up after ${maxRetries} retries)`);
  }

  const retryAfter = parseRetryAfter(res) ?? 30;
  console.log(`[registerAndGetSessionCookie] register 429; waiting ${retryAfter}s before retry (attempt ${attempt + 1}/${maxRetries})`);
  await sleep(retryAfter * 1000);
  return registerWithRetry(request, name, email, password, attempt + 1, maxRetries);
}

/**
 * Parse the Retry-After header (seconds or HTTP-date).
 * Returns null if the header is missing or unparseable.
 */
function parseRetryAfter(res: APIResponse): number | null {
  const header = res.headers()['retry-after'];
  if (!header) return null;

  // Could be either a number of seconds or an HTTP-date.
  const asNumber = Number(header);
  if (!Number.isNaN(asNumber) && Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.ceil(asNumber);
  }
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    return Math.max(1, Math.ceil((asDate - Date.now()) / 1000));
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
