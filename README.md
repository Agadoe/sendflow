# SendFlow

WhatsApp mass-messaging SaaS for African micro and small businesses.

Built for salons, eateries, churches, and any business that needs to reach customers on WhatsApp — without paying enterprise prices.

## Features

- 📊 **Spreadsheet import** — upload contacts from CSV/Excel
- 💬 **Broadcast & drip campaigns** — send now or schedule sequences
- 🏷️ **Contact tagging** — organize audiences
- 👥 **Team access** — multi-user accounts with role-based permissions
- 📈 **Delivery analytics** — track opens, replies, and conversions
- 🔗 **Lead capture forms** — collect contacts via WhatsApp chat links
- 💳 **Paystack billing** — GH₵ pricing tiers for African markets

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** libSQL (Turso) + Prisma ORM
- **Auth:** Custom JWT (Jose) with cookie-based sessions
- **Email:** Resend API (production) / Nodemailer SMTP (dev)
- **Payments:** Paystack
- **Testing:** Playwright (E2E)
- **Hosting:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Turso/libSQL database (or local SQLite for dev)
- Resend API key (for production email)
- Paystack keys (for billing)

### Installation

```bash
# Clone the repository
git clone https://github.com/Agadoe/sendflow.git
cd sendflow

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ^ Paste this into NEXTAUTH_SECRET in .env.local

# Set up database
npm run db:generate
npm run db:push

# Run development server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | libSQL/Turso connection string |
| `NEXTAUTH_SECRET` | **Yes** | 64-char hex JWT secret (generate with crypto) |
| `NEXTAUTH_URL` | Yes | Your app URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public-facing app URL |
| `RESEND_API_KEY` | For email | Resend API key for transactional email |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Fallback | cPanel SMTP credentials (dev fallback) |
| `PAYSTACK_SECRET_KEY` | For billing | Paystack test/live secret key |
| `PAYSTACK_PUBLIC_KEY` | For billing | Paystack public key for frontend |

**⚠️ Security:** Never commit `.env` files. The app will refuse to start if `NEXTAUTH_SECRET` or `JWT_SECRET` is missing in production.

## Project Structure

```
sendflow/
├── src/
│   ├── app/                 # Next.js App Router pages & API routes
│   ├── components/          # React components
│   ├── lib/                 # Utilities (auth, email, prisma, validation)
│   └── middleware.ts        # Route protection & role checks
├── prisma/
│   └── schema.prisma        # Database schema
├── scripts/                 # One-off tools, daemons, and fix scripts
├── tests/e2e/               # Playwright end-to-end tests
├── .env.local.example       # Environment template
└── next.config.js           # Next.js configuration
```

## Authentication

SendFlow uses a custom JWT-based auth system:

- `sf_token` HTTP-only cookie stores the JWT
- Tokens expire after 7 days
- Two user roles: `ADMIN` (dashboard) and `CLIENT` (client portal)
- Email verification required before first login
- Password reset via secure token emailed to user

**Security features:**
- Rate limiting on all auth endpoints (in-memory, per-IP)
- Input validation with Zod on all API routes
- `Secure` flag on cookies in production
- Passwords hashed with bcrypt (12 rounds)
- No passwords returned in API responses

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel dashboard
3. Add environment variables from `.env.local`
4. Deploy

### Environment Checks Before Deploy

```bash
# Verify build passes
npm run build

# Run E2E tests
npx playwright test

# Verify JWT secret is set
node -e "if(!process.env.JWT_SECRET&&!process.env.NEXTAUTH_SECRET)throw new Error('Missing JWT secret')"
```

## Database Migrations

```bash
# Generate migration after schema changes
npx prisma migrate dev --name descriptive_name

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio
npm run db:studio
```

## Security

See `AUDIT-2026-06-02.md` for the latest security audit status.

Key policies:
- All API routes validate input with Zod schemas (`src/lib/validation.ts`)
- Auth tokens verified via centralized `src/lib/jwt.ts` (no hardcoded secrets)
- Rate limits enforced on auth, registration, and password reset endpoints
- Cookies use `HttpOnly`, `Secure` (prod), `SameSite=Lax`

## Scripts

One-off utilities and daemon scripts live in `scripts/`:

| Script | Purpose |
|--------|---------|
| `add-contacts.js` | Bulk import contacts |
| `seed-admin.js` | Create initial admin account |
| `wacli-daemon.js` | WhatsApp CLI daemon for message sending |
| `baileys-daemon.js` | Alternative WhatsApp daemon (Baileys) |
| `smtp-relay.py` | Python SMTP relay utility |

## Testing

```bash
# Run Playwright E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/auth.spec.ts
```

## License

Private — All rights reserved.

## Support

For issues or questions, contact the development team.
