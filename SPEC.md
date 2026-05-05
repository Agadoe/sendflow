# WhatsApp SaaS — Product Specification

## 2. Concept & Vision

A bulk WhatsApp marketing platform for African SMBs — salons, boutiques, restaurants, network marketers, churches. The product communicates **clarity, reliability, and African warmth** — not another cold Silicon Valley SaaS. It's the tool a busy shop owner in Accra opens every morning to broadcast their daily deals.

**Product name:** SendFlow — tagline: *"Reach them where they already are."*

**Competitive positioning:**
- Focus on **simplicity and affordability** vs. feature-bloated enterprise tools
- **Drip messaging + native lead forms** as primary differentiators vs. WhatChimp
- Target African payment realities (M-Pesa, bank transfer) — not credit-card-centric
- Warm, confident brand voice — not corporate, not hype

---

## 2. Design Language

### Aesthetic Direction
**"Warm Professional"** — inspired by African textile patterns and warm market stalls, but executed with clean SaaS discipline. Think: bold typographic hierarchy, warm amber/gold accents against cream backgrounds, subtle geometric patterns inspired by kente cloth.

### Color Palette
```
--color-bg:           #FFFDF7   (warm cream)
--color-surface:      #FFFFFF   (pure white cards)
--color-primary:      #E8961C   (warm amber/gold — action buttons)
--color-primary-dark:#C4770F   (hover states)
--color-accent:       #2D3748   (slate charcoal — body text)
--color-accent-light:#718096   (secondary text)
--color-success:      #22C55E   (delivery confirmed)
--color-warning:      #F59E0B   (pending)
--color-error:        #EF4444   (failed)
--color-telegram:     #0088CC   (Telegram shares)
--color-green:        #16A34A   (WhatsApp brand)
```

### Typography
- **Headings:** `DM Serif Display` — warm, editorial, distinctive
- **Body:** `Inter` — clean, readable at all sizes
- **Mono/Data:** `JetBrains Mono` — for stats, numbers

### Spatial System
- Base unit: 4px
- Section padding: 80px vertical, 24px horizontal
- Card padding: 24px
- Border radius: 12px (cards), 8px (buttons), 24px (pills)

### Motion
- Entrance: fade-up, 400ms ease-out, staggered 80ms
- Hover: 150ms ease, subtle scale(1.02) on cards
- Button hover: background shift + slight lift shadow
- Page transitions: 300ms fade

### Visual Assets
- Hero background: subtle kente-inspired geometric SVG pattern at 5% opacity
- Icons: Lucide React (consistent stroke weight)
- WhatsApp green used sparingly as a brand nod (CTA buttons, success states)

---

## 3. Layout & Structure

### Landing Page Sections (top-to-bottom)
1. **Navbar** — Logo + "Get Early Access" CTA
2. **Hero** — Bold headline, subheadline, dual CTAs (Join Waitlist / See Pricing), animated WhatsApp message preview mockup
3. **Social Proof Bar** — "200+ businesses on the waitlist" + logos/stats
4. **Problem Section** — "Your customers are on WhatsApp. You're texting one by one."
5. **Solution Section** — How SendFlow works (3 steps: Import → Compose → Send)
6. **Features Grid** — 6 feature cards with icons
7. **Pricing Tiers** — Free / Starter ($29) / Growth ($79) / Pro ($199)
8. **FAQ** — 5 common objections answered
9. **CTA Section** — Final push to join waitlist
10. **Footer** — Links, legal, social

### Dashboard (authenticated)
- **Sidebar** — Navigation (Campaigns, Contacts, Automations, Analytics, Settings)
- **Main area** — Active view with top stats bar
- **WhatsApp connection status** — prominent indicator

### Responsive Strategy
- Mobile-first breakpoints: sm(640), md(768), lg(1024), xl(1280)
- Landing page stacks vertically on mobile
- Dashboard collapses sidebar to hamburger menu on mobile

---

## 4. Features & Interactions

### Landing Page
- **Waitlist form:** Name, Email, Business type (dropdown), Phone — on submit → saves to DB + shows success message + triggers "check your email" state
- **Pricing toggle:** Monthly / Annual (20% discount) — switches displayed prices
- **FAQ accordion:** click to expand/collapse

### Dashboard — Campaign Builder
- **Step 1 — Recipients:** CSV upload (drag-and-drop) or manual add → shows contact count + validation status. Also select from saved segments.
- **Step 2 — Compose:** Rich text editor (bold, italic, links) + media attachment (image/document) + preview as WhatsApp message bubble
- **Step 3 — Schedule or Send:** Schedule for later datetime OR send immediately → confirmation modal → spinning state → result toast
- **Campaign list:** Table with status badges (Draft, Scheduled, Sent, Failed) + stats (Sent, Delivered, Failed, Pending)
- **Campaign duplication:** Copy an existing campaign as a starting point for new ones
- **Recurring campaigns:** Set campaigns to repeat daily, weekly, or monthly — ideal for recurring promotions or appointment reminders

### Dashboard — Contacts
- Upload CSV/Excel with column mapping UI
- Searchable contact list (name, phone, tags)
- **Bulk tag/untag:** Select multiple contacts and apply or remove tags at once
- **Contact segmentation:** Filter contacts by tag, date added, or name — save segments as reusable recipient lists for campaigns
- Import history log
- **Native WhatsApp Form:** A shareable link that opens a WhatsApp chat and collects data via a conversational form (name, phone, custom questions). Responses auto-saved as contacts with tags. Great for lead capture without a landing page.

### Dashboard — Automations (Drip Messaging)
- Visual automation builder — no-code flow builder with trigger → condition → action blocks
- Trigger types:
  - **Contact added** — e.g. welcome message series
  - **Tag applied** — trigger a follow-up sequence when a contact is tagged "hot-lead"
  - **Date/time-based (Drip)** — delay X hours/days, then send a message. Chain multiple delays to build a drip sequence
- Conditions: "if contact has tag X, skip step Y"
- Actions per step: Send a template message, Apply tag, Remove tag, Send to another automation
- Automation execution log — see which contacts entered, which steps completed, which dropped off
- Toggle automations on/off without deleting them

### Dashboard — Analytics
- Campaign performance cards: Total Sent, Delivered Rate %, Failed Rate %
- Line chart: messages sent over last 7 days
- Bar chart: delivery rate by campaign
- Per-campaign drill-down

### Dashboard — Settings
- **WhatsApp Connection:** Connect via wacli (show connection flow instructions) + status indicator
- **Team Members & Roles:** Invite team members by email with role-based access:
  - **Admin** — full access including billing and settings
  - **Editor** — can create and send campaigns, manage contacts
  - **Viewer** — read-only access to campaigns and analytics
- **Billing:** Current plan, upgrade button, billing history (static for MVP)
- **API Keys:** Display generated API key + copy button
- **Click-to-WhatsApp Links:** Generate shareable links that open a WhatsApp chat with a pre-filled message. Useful for Meta/Instagram ads, website buttons, and social posts. Each link can include UTM parameters for tracking.

### Error States
- CSV upload wrong format → red error banner with format hints
- WhatsApp not connected → warning banner with "Connect now" CTA
- Message send failure → per-recipient failure report
- Network error → retry button with exponential backoff UI

### Empty States
- No campaigns: illustration + "Create your first campaign" button
- No contacts: illustration + "Import your first contact list" button

---

## 5. Component Inventory

### Button
- **Variants:** primary (amber), secondary (outline), ghost, danger
- **Sizes:** sm (32px h), md (40px h), lg (48px h)
- **States:** default, hover (lift shadow), active (pressed), disabled (40% opacity), loading (spinner)

### Badge
- **Variants:** success (green), warning (amber), error (red), info (blue), neutral (gray)
- **Size:** pill shape, 12px font, 4px 12px padding

### Card
- White background, 12px radius, subtle shadow
- Hover: shadow-lg + translateY(-2px)
- Header + body + footer slots

### Stats Card
- Large number (DM Serif Display, 32px)
- Label below (Inter, 14px, muted)
- Optional trend indicator (+/- %)

### Campaign Row
- Status badge + name + created date + sent/delivered/failed counts
- Row actions: Edit, Duplicate, Delete (hover reveal)

### Contact Row
- Avatar circle (initials) + name + phone + tags
- Row checkboxes for bulk selection
- Row actions: Edit, Delete

### Sidebar Nav Item
- Icon + label
- Active state: amber left border + amber text + light amber background
- Hover: light gray background

### Modal
- Centered, max-w-md, backdrop blur
- Header (title + close X), body, footer (cancel + confirm buttons)
- Entrance: scale from 95% + fade

### Toast
- Bottom-right stack
- Success (green left border), Error (red), Info (blue)
- Auto-dismiss after 4s, manual close X

### Message Bubble (preview)
- WhatsApp-style: rounded rectangle, slight shadow
- Outgoing: amber background, right-aligned
- Shows phone number or contact name as header

---

## 6. Technical Approach

### Framework & Runtime
- **Next.js 14** (App Router) — frontend + API routes
- **TypeScript** throughout
- **Node.js 20+**

### Database
- **PostgreSQL** via **Prisma ORM**
- Hosted on **Neon** (free tier: 0.5GB RAM, 0.5GB storage) or **Railway**

### Authentication
- **NextAuth.js v5** — magic link email (no passwords), Google OAuth as option
- JWT sessions stored in cookies

### File Storage
- **Uploaded media** (images/documents for campaigns): Cloudinary (free tier: 25GB)
- Contact CSVs: processed server-side, stored as compressed blobs in DB

### WhatsApp Sending
- **MVP:** `wacli` CLI on the server — polls queue, sends via personal WhatsApp number
- **Scale phase:** WATI or YCloud Meta BSP API

### Payment (MVP)
- Manual: Bank transfer / M-Pesa — admin marks account as paid
- **Phase 2:** Paystack or Flutterwave for card/MoMo payments

### API Design
```
POST   /api/auth/register         — create account
POST   /api/auth/login            — magic link send
POST   /api/auth/verify           — verify magic link token
GET    /api/auth/me               — current user

GET    /api/campaigns             — list campaigns
POST   /api/campaigns             — create campaign
GET    /api/campaigns/:id         — get campaign detail
PUT    /api/campaigns/:id         — update campaign
DELETE /api/campaigns/:id         — delete campaign
POST   /api/campaigns/:id/send    — send campaign now
POST   /api/campaigns/:id/duplicate — duplicate a campaign

GET    /api/contacts              — list contacts (paginated, filterable by tag)
POST   /api/contacts/import       — CSV upload + parse
DELETE /api/contacts/:id          — delete contact
PUT    /api/contacts/:id/tags     — bulk update tags
GET    /api/contacts/segments     — list saved segments
POST   /api/contacts/segments     — save a segment filter set

GET    /api/automations           — list automations
POST   /api/automations           — create automation
GET    /api/automations/:id       — get automation detail
PUT    /api/automations/:id       — update automation
DELETE /api/automations/:id       — delete automation
POST   /api/automations/:id/toggle — enable/disable
GET    /api/automations/:id/logs  — execution logs

GET    /api/analytics             — dashboard stats
GET    /api/analytics/:id         — per-campaign stats

GET    /api/settings              — user settings
PUT    /api/settings              — update settings
POST   /api/settings/upgrade      — trigger upgrade flow
GET    /api/settings/team         — list team members
POST   /api/settings/team/invite  — invite team member
DELETE /api/settings/team/:id     — remove team member
GET    /api/links                 — list click-to-WhatsApp links
POST   /api/links                 — create a new link

POST   /api/webhooks/paystack     — payment webhook
```

### Data Model
```prisma
User          — id, email, name, phone, plan, createdAt
Campaign      — id, userId, name, status, scheduledAt, sentAt, recurrence, createdAt
Message       — id, campaignId, contactId, status, sentAt, deliveredAt, failedAt
Contact       — id, userId, phone, name, tags[], createdAt
Automation    — id, userId, name, description, trigger, triggerConfig, conditions, actions, isEnabled, lastTriggered
AutomationExecution — id, automationId, contactId, event, payload, executedAt
Payment       — id, userId, amount, plan, status, createdAt
Waitlist      — id, email, name, businessType, phone, createdAt
ApiKey        — id, userId, key, lastUsed, createdAt
TeamMember    — id, userId, email, role (ADMIN|EDITOR|VIEWER), invitedAt, joinedAt
ClickToWhatsAppLink — id, userId, name, phone, prefillMsg, utmSource, utmMedium, utmCampaign, createdAt
```

**Schema changes from original:**
- `Campaign` gains `recurrence` field (DAILY|WEEKLY|MONTHLY|null)
- `Automation` model already has `trigger`, `triggerConfig`, `conditions`, `actions` — fully supports drip sequences
- New: `TeamMember` — roles & permissions
- New: `ClickToWhatsAppLink` — click-to-WhatsApp link generator
- `Contact.tags` already exists as String/JSON array

### Environment Variables
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<random>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLOUDINARY_URL=
WCLI_TOKEN=           # wacli auth token
PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
```