/**
 * Build a secure Set-Cookie header value for the sf_token auth cookie.
 *
 * Always sets HttpOnly, Path=/, and SameSite=Lax.
 * Secure flag is added in production (Vercel uses HTTPS).
 * Use MaxAge = 0 to clear the cookie (logout).
 */
export function buildAuthCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = maxAgeSeconds > 0 ? `; Max-Age=${maxAgeSeconds}` : '; Max-Age=0';
  return `sf_token=${token}${maxAge}; HttpOnly; Path=/; SameSite=Lax${secure}`;
}
