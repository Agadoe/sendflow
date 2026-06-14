# SendFlow Codebase Audit Report

**Date:** 2026-06-14
**Branch:** clio/audit-and-fix
**Commit:** 0c8c2419 (latest)

## 1. SECURITY ISSUES

### CRITICAL

**1. Debug/Test Endpoints in Production**
- **Files:** 
  - `src/app/api/auth/debug-verify/route.ts` - Diagnostic endpoint that exposes user email verification status
  - `src/app/api/debug-db/route.ts` - Database connectivity test endpoint
- **Risk:** These endpoints could expose internal state and user data to unauthorized users
- **Recommendation:** Remove these endpoints before production deployment

**2. Weak JWT Secret Fallback**
- **Files:** Multiple files using `process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'`
- **Risk:** If neither environment variable is set, the application falls back to the weak default `'development-secret'`
- **Recommendation:** Enforce that `JWT_SECRET` is set in production environments and fail to start if not present

### HIGH

**3. Console Logging in Production Routes**
- **Files:** Multiple API routes contain `console.log` and `console.error` statements
- **Risk:** Could potentially leak sensitive information or internal state in logs
- **Examples:**
  - `src/app/api/auth/verify/route.ts` - Logs attribution data
  - `src/app/api/kgc-contact/route.ts` - Logs contact form data
- **Recommendation:** Remove or sanitize logging in production builds

### MEDIUM

**4. Test Mode Email Routing**
- **Files:** `src/lib/email.ts` with `testMode: true` used in several auth routes
- **Risk:** While currently routing to approval inbox, this could be accidentally disabled in production
- **Recommendation:** Ensure test mode is explicitly disabled in production environments

## 2. CODE HYGIENE ISSUES

### Commented-Out Code

**1. TODO Comments**
- **Files:**
  - `src/app/dashboard/messages/page.tsx` - TODO for resend endpoint
  - `src/app/api/settings/team/route.ts` - TODO for invite email
  - `src/app/api/auth/verify/route.ts` - TODO for lead attribution persistence
  - `src/lib/rate-limit.ts` - TODO for Redis implementation
- **Recommendation:** Address these TODOs or create tracking issues

### Leftover Debugging Code

**2. Debug Endpoints**
- As mentioned in security section, these should be removed

### Inconsistent Error Handling

**3. Error Handling Patterns**
- Some routes use `console.error` for logging errors
- Some routes return generic "Login failed" messages
- **Recommendation:** Standardize error handling and logging across all routes

## 3. AUTH FLOW GAPS

### Email Verification Flow

**Status:** Mostly complete but with some gaps

**Verified Working:**
- Registration creates user with `emailVerified: null`
- Verification token sent via email
- `/api/auth/verify-email` consumes token and sets `emailVerified`
- Login gated on `emailVerified` status
- Resend verification link functionality

**Gaps:**
1. **Old Magic Link Endpoint Still Active**
   - `/api/auth/verify` (JWT-based magic link) is still present and functional
   - This bypasses the email verification requirement
   - **Recommendation:** Remove or disable this endpoint if not needed

2. **Client Auth Verification**
   - Client portal routes (`src/app/api/client-auth/`) don't appear to have the same email verification treatment
   - **Recommendation:** Ensure client accounts also go through email verification

### Rate Limiting

**Status:** Well implemented

- Consistent use of `clientKey` function for rate limiting across auth routes
- Appropriate limits for different endpoints (login, register, resend verify)
- Uses sliding window algorithm

## 4. TEST SUITE STATUS

### Playwright Tests

**Status:** 10 tests defined, 1 failing

**Failing Test:**
- Test 1: "admin register → /dashboard with session cookie" - Timeout waiting for redirect to /dashboard

**Analysis:**
- This suggests the registration flow is not redirecting correctly to the dashboard after successful registration
- Could be related to email verification flow not issuing session cookie correctly

**Other Tests:**
- Not run due to first test failure
- Need to re-run full suite after fixing the first test

### Missing Tests

**1. Email Verification Flow**
- No specific tests for the email verification flow (`/api/auth/verify-email`)
- Should test both valid and expired tokens
- Should test redirect behavior

**2. Resend Verification**
- No specific tests for `/api/auth/resend-verify`

## 5. STASH RECOMMENDATION

**Status:** No stashes found

All previous work appears to have been committed or discarded.

## 6. RECOMMENDED FIX ORDER

### Immediate (Critical Security)

1. **Remove Debug/Test Endpoints**
   - Delete `src/app/api/auth/debug-verify/route.ts`
   - Delete `src/app/api/debug-db/route.ts`

2. **Enforce JWT Secret**
   - Modify auth middleware to fail if `JWT_SECRET` is not set in production

### High Priority (Security & Functionality)

3. **Fix Playwright Test Suite**
   - Investigate and fix the failing registration test
   - Add tests for email verification flow
   - Add tests for resend verification flow

4. **Remove Old Magic Link Endpoint**
   - Evaluate if `/api/auth/verify` is still needed
   - If not, remove it to avoid bypassing email verification

5. **Standardize Error Handling**
   - Remove or sanitize console logging in production routes
   - Standardize error responses across API endpoints

### Medium Priority (Hygiene & Completeness)

6. **Address TODO Comments**
   - Create tracking issues for each TODO
   - Implement missing features like resend SMTP endpoint

7. **Client Auth Verification**
   - Ensure client portal accounts also require email verification

8. **Add Missing Tests**
   - Write tests for email verification flow
   - Write tests for resend verification flow
   - Write tests for client auth flows

### Long Term (Enhancement)

9. **Implement Redis-based Rate Limiting**
   - Replace in-memory rate limiting with Redis for production deployments

10. **Lead Attribution Persistence**
    - Implement the TODO to persist attribution to a `LeadAttribution` table