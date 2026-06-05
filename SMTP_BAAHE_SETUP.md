# SMTP Setup — baahe.org (cPanel)

## Status: ✅ Code updated, awaiting Vercel env vars

**What's done:**
- `/api/contact` now uses `mail.baahe.org:465` (SMTPS, TLS on connect) instead of `smtp.gmail.com:587`
- Default from/to addresses set to `sendflow@baahe.org`
- Cert validation enabled (`rejectUnauthorized: true`)
- Mail server confirmed reachable: `nc -zv mail.baahe.org 465` → succeeded

## Steps for Don

### 1. Create the mailbox in cPanel (if not already done)
1. Log into cPanel at https://baahe.org:2083 (or your custom cPanel URL)
2. Email Accounts → Create
3. Email: `sendflow@baahe.org`
4. Generate a strong password (or use the Password Generator)
5. **Save this password** — you'll need it for Vercel env

### 2. (Optional) Add an alias for replies
- Forwarders → Add Forwarder
- `contact@baahe.org` → forwards to `sendflow@baahe.org` (or to your personal inbox)
- This way the marketing copy `mailto:contact@baahe.org` (if you add it later) works

### 3. Set Vercel env vars
From `~/whatsapp-saas/`:

```bash
# The actual SMTP creds
echo "sendflow@baahe.org" | vercel env add SMTP_USER production
echo "YOUR_CPANEL_MAILBOX_PASSWORD" | vercel env add SMTP_PASS production

# Where contact-form notifications get sent (defaults to sendflow@baahe.org)
echo "sendflow@baahe.org" | vercel env add CONTACT_TO_EMAIL production
echo "sendflow@baahe.org" | vercel env add CONTACT_FROM_EMAIL production

# Then redeploy so the new env vars are baked into the function bundle
vercel deploy --prod
```

### 4. Test
```bash
curl -X POST https://sendflow-two.vercel.app/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Setup Test","email":"setup-test@baahe.org","subject":"SMTP test","message":"Verifying mail.baahe.org works."}'
```
- Should return 200
- Email should arrive in `sendflow@baahe.org` inbox
- Dashboard at `/dashboard/messages` should show the entry with `emailSent: true`

## What this fixes
- `/api/contact` was using `smtp.gmail.com:587` with no creds set → every contact form email failed with `Missing credentials for PLAIN`
- Now points to your actual mail server with TLS
- `/api/kgc-contact` is **not** updated — it uses Gmail for KGC's separate lead flow, leave alone unless you want KGC leads going through the same SendFlow mailbox

## Security notes
- Password stored encrypted in Vercel
- TLS on connect (port 465) — credentials never sent in cleartext
- Cert validation enforced (no MITM tolerance)
- Mailbox password should be unique to SendFlow — if you ever rotate the cPanel password for `sendflow@baahe.org`, update Vercel env
