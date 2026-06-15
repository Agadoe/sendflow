/**
 * Centralized JWT secret for the SendFlow auth system.
 *
 * Throws at **runtime** if JWT_SECRET or NEXTAUTH_SECRET is missing.
 * This allows `next build` to complete without env vars, while ensuring
 * the app refuses to serve requests in production without a real secret.
 *
 * Usage:
 *   import { getJWTSecret } from '@/lib/jwt';
 *   await jwtVerify(token, getJWTSecret());
 *   await new SignJWT(payload).sign(getJWTSecret());
 */

let _secret: Uint8Array | null = null;

export function getJWTSecret(): Uint8Array {
  if (_secret) return _secret;

  const raw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error(
      'JWT_SECRET or NEXTAUTH_SECRET must be set in environment variables. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  _secret = new TextEncoder().encode(raw);
  return _secret;
}

// Backwards-compatible re-export for files that destructure { getJWTSecret }
export { getJWTSecret as JWT_SECRET };
