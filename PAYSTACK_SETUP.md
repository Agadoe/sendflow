# Paystack Setup — SendFlow

## Status: ✅ Integration deployed, awaiting live Paystack account keys

**What works in production right now:**
- `/subscribe` page with 3 plans (Starter GHS 299, Growth GHS 799, Pro GHS 1999)
- `/api/paystack/plans` — public plan list
- `/api/paystack/initialize` — creates a Paystack transaction, returns authorization URL
- `/api/paystack/verify/[ref]` — verifies a transaction by reference
- `/api/paystack/webhook` — receives `charge.success` events, updates User.plan
- Homepage pricing CTAs route to `/subscribe?plan=STARTER` etc.
- Idempotent Payment table writes (unique on `ref`)

**What's needed from Don to go live:**

### 1. Get Paystack API keys
1. Sign up at https://paystack.com (Ghana/Nigeria business)
2. Settings → API Keys & Webhooks
3. Copy **Test Secret Key** (`sk_test_...`) and **Test Public Key** (`pk_test_...`)
4. Later, after testing, do the same for **Live Secret Key** (`sk_live_...`) and **Live Public Key** (`pk_live_...`)

### 2. Set env vars in Vercel
Run these from `~/whatsapp-saas/`:

```bash
# Test keys first
echo "sk_test_your_real_key" | vercel env add PAYSTACK_SECRET_KEY production
echo "pk_test_your_real_key" | vercel env add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY production

# When ready for production, update with live keys
# (vercel env rm then vercel env add, or use the Vercel dashboard)
```

Current placeholders are set in Vercel — they need to be replaced with the real keys. The integration will fail with `PAYSTACK_SECRET_KEY is not set` or auth errors until real keys are present.

### 3. Configure webhook in Paystack dashboard
1. Settings → API Keys & Webhooks → **Webhook URL**
2. Set to: `https://sendflow-two.vercel.app/api/paystack/webhook`
3. Paystack will POST `charge.success` events to this URL
4. The route verifies HMAC-SHA512 signature against `PAYSTACK_SECRET_KEY` automatically

### 4. Test the flow
1. Visit https://sendflow-two.vercel.app/subscribe
2. Click "Subscribe" on Starter (or any plan)
3. Paystack hosted checkout opens
4. Use Paystack test card: `4084 0840 8408 4081`, exp `12/30`, CVV `408`, PIN `0000`, OTP `123456`
5. After payment, redirected to `/subscribe/verify?reference=...`
6. Page shows success, polls for plan activation, redirects to `/dashboard`
7. Webhook fires in background, updates `User.plan` to STARTER/GROWTH/PRO

### Test card
```
Card: 4084 0840 8408 4081
Exp:  12/30
CVV:  408
PIN:  0000
OTP:  123456
```

### Switching to live mode
1. Run `vercel env rm PAYSTACK_SECRET_KEY production` then re-add with `sk_live_...`
2. Same for `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` with `pk_live_...`
3. Update webhook URL in Paystack Live dashboard to the same URL
4. Test with a real small payment (e.g. GHS 1.00 via direct Paystack, or use a friend to test)

### Files
- `src/lib/paystack.ts` — REST client, plan list, signature verification
- `src/app/api/paystack/{initialize,verify,webhook,plans}/route.ts` — 4 API routes
- `src/app/subscribe/{page.tsx,verify/page.tsx}` — 2 pages
- `src/app/page.tsx` — pricing CTAs updated to point to `/subscribe?plan=...`

### How the data flows
1. User clicks "Subscribe" → `/api/paystack/initialize` (auth required, JWT in `sf_token` cookie)
2. Server calls Paystack's `transaction/initialize` with email, amount (kobo), metadata `{plan_code, user_id}`
3. Paystack returns `authorization_url` → client redirects user
4. User pays on Paystack hosted page
5. Paystack redirects to `/subscribe/verify?reference=XYZ`
6. Verify page calls `/api/paystack/verify/XYZ` → shows success
7. **In parallel**, Paystack POSTs to `/api/paystack/webhook` with `charge.success` event
8. Webhook verifies signature, creates Payment row (idempotent on `ref`), updates `User.plan`
9. User is now on the new plan. The verify page redirects them to `/dashboard`.

### Security notes
- HMAC-SHA512 signature verification on every webhook (rejects unsigned requests)
- `amount` checked against expected plan amount (rejects amount-manipulation attacks)
- `metadata.user_id` used to update plan (not email — emails can be reassigned)
- Payment row has `unique(ref)` so duplicate webhooks are no-ops
- Rate-limited: 10 init attempts / 5 min per IP (same rate-limit lib as auth)
- Auth required for initialize; webhook is public but signature-gated
