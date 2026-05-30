# Makara CV — Cinematic 3D Khmer Resume Studio

Production-grade Next.js 14 platform: a visually rich 3D platform shell around
pixel-perfect **2D A4 CV documents**, engineered first-class for the **Khmer
language**. An AI career consultant interviews users *in Khmer* to surface real
metrics, then renders a clip-free Khmer CV exportable to PDF / PNG / ATS.

> Seeded from the proven **Chrono CV** engine (`makarachan-dotcom/ai`); this repo
> adds the Khmer typography system, the AI Khmer Interviewer, the multi-format
> export engine, and the 2D A4 document renderer.

## What it ships

1. **Telegram-only authentication** — two interoperating flows:
     - **Bot deep-link** (default): the site mints a token, opens
       `t.me/<bot>?start=login_<token>`, the bot webhook authenticates the
       user, the browser polls and gets a session. Works on any Telegram
       client including web-only.
     - **Login Widget** (still supported on `/api/auth/telegram`): HMAC-SHA256
       verification of the official widget payload against the bot token.
   No JWT, no third-party OAuth.
2. **Rolling 2-per-168h CV generation cooldown** — Postgres row-level locking
   (`SELECT FOR UPDATE`) plus optional Redis atomic locks.
3. **7-day consecutive UTC check-in streak** — unlocks 18 premium WebGL
   templates. Day comparison is at absolute UTC midnight (`YYYY-MM-DD`).
4. **20 WebGL templates** (2 free + 18 locked) rendered with React Three Fiber.
5. **Reactive scene mutation** — colors, materials, lights, camera bind through
   a ref-based `SceneController` so tweaks never re-render the canvas tree.
6. **3-second hold-to-reveal Telegram admin button** (`@AF4STURF`) with
   AES-256-GCM ciphertext storage and a SESSION_SECRET-bound HMAC handshake.
7. **Khmer typography system** — Kantumruy Pro, Hanuman, Nokora & Siemreap
   self-hosted via `next/font`, with explicit anti-clipping line-height/padding
   rules so dependent vowels (ស្រៈ) and subscripts (ជើងអក្សរ) never clip on web
   or in PDF export. Users swap fonts, line spacing and accent color live.
8. **AI Khmer Interviewer** — an interactive, industry-aware career consultation
   conducted entirely in Khmer (no cold form). Deterministic rule-based engine by
   default; optional OpenAI-compatible LLM polish when a key is configured.
9. **Multi-format export engine** — pluggable exporters: vector **PDF** (A4,
   embedded Khmer fonts via the print pipeline), high-res **PNG** (3×), and
   **ATS** plain-text + structured JSON.
10. **2D A4 CV document** — executive-grade, highly scannable, Khmer-safe layout
    rendered at exact A4 proportions (the docs are 2D; only the shell is 3D).

### The Khmer Studio (`/studio`)

The new authoring surface chains it all together: AI Khmer interview → live A4
preview → typography controls (font / line-spacing / accent) → multi-format
export. It is intentionally public (it touches no protected data); the gated 3D
generation/deploy actions still require a Telegram session.

#### Khmer anti-clipping strategy

Khmer is a complex stacking script. Clipping is prevented by, in `globals.css`
and `tailwind.config.ts`:

- `:lang(km)` / `.khmer` → `line-height: 2.05`, `padding-block: 0.12em`,
  `overflow: visible`, `word-break: normal`, `overflow-wrap: anywhere`.
- `.khmer-doc` (A4 body) → `line-height: 1.7` + top/bottom padding so ស្រៈ and
  ជើង clear the page edge.
- `.khmer-heading` → extra top padding for diacritic-dense headings.
- Fonts are **self-hosted** (woff2 under `/_next`) so `window.print()` →
  *Save as PDF* embeds them and preserves exact shaping (no glyph fallback).

## Stack

- Next.js 14 (App Router, RSC, Route Handlers)
- TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`)
- Prisma ORM + raw migrations with full RLS policies
- PostgreSQL 14+ / Supabase
- React Three Fiber + drei + Three.js 0.169
- TailwindCSS + `next/font` Khmer Unicode fonts
- `html-to-image` for high-res PNG export; browser print pipeline for vector PDF
- Optional Redis (ioredis) for distributed atomic locking
- Optional OpenAI-compatible LLM for Khmer summary enrichment
- Zod for strict input validation

## Setup

```bash
# 1. Install
npm install

# 2. Configure env (see .env.example)
cp .env.example .env

# 3. Generate Prisma client + apply schema
npm run prisma:generate
npm run prisma:deploy

# 4. Encrypt the admin Telegram handle
ADMIN_HANDLE_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  npx tsx scripts/encrypt-admin-handle.ts AF4STURF

# 5. Register the Telegram bot webhook (once per domain)
TELEGRAM_BOT_TOKEN=... \
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32) \
  npx tsx scripts/setup-telegram-webhook.ts https://your-domain.vercel.app

# 6. Dev
npm run dev
```

### Telegram bot setup checklist

1. `@BotFather` → `/newbot` → save token (`TELEGRAM_BOT_TOKEN`) and username
   (`TELEGRAM_BOT_USERNAME`, no `@`).
2. `/setdomain` on the bot → reply with your live domain (only required for
   the optional Login Widget flow; the bot deep-link flow works without it).
3. Set `TELEGRAM_WEBHOOK_SECRET` (random hex). Run
   `scripts/setup-telegram-webhook.ts` after the domain is live so Telegram
   POSTs `/start` events to `/api/telegram/webhook`.

## Architecture

```
src/
├── app/                              Next.js routes
│   ├── api/
│   │   ├── auth/telegram/route.ts    Telegram Login Widget HMAC verify
│   │   ├── auth/init/route.ts        Mint deep-link login token
│   │   ├── auth/poll/route.ts        Poll for bot-confirmed login
│   │   ├── telegram/webhook/route.ts Telegram bot webhook receiver
│   │   ├── auth/logout/route.ts
│   │   ├── generate/route.ts         POST: 2/7d cooldown enforcement
│   │   ├── checkin/route.ts          POST: UTC streak engine
│   │   ├── admin-link/route.ts       POST: 3s hold handshake verify
│   │   ├── admin-link/proof/route.ts POST: server-side proof generator
│   │   └── templates/route.ts        GET: template + unlock state
│   ├── dashboard/page.tsx
│   ├── login/page.tsx
│   └── templates/[slug]/page.tsx
├── components/
│   ├── HoldToReveal.tsx              3-second hold button
│   ├── TelegramLoginButton.tsx       Bot deep-link login button (polling)
│   ├── StreakMatrix.tsx              7-day progress grid
│   └── canvas/
│       ├── CVCanvas.tsx
│       ├── CustomizationPanel.tsx
│       ├── SceneController.ts        Ref-based reactive store
│       ├── SceneBindings.tsx
│       └── scenes/                   Per-template R3F scenes
├── lib/
│   ├── telegram.ts                   HMAC verification + payload parsing
│   ├── telegram-bot.ts               Bot API client (sendMessage / setWebhook)
│   ├── login-token.ts                Bot deep-link token generator + validator
│   ├── session.ts                    Signed-cookie session crypto
│   ├── admin-handle.ts               AES-256-GCM encrypt/decrypt
│   ├── cooldown.ts                   2-per-168h evaluator
│   ├── streak.ts                     UTC consecutive-day decider
│   ├── lock.ts                       Redis SET NX PX atomic lock
│   └── db.ts                         Prisma + RLS GUC binder
├── middleware.ts                     Auth interceptor (deterministic JSON 401)
│   ├── interview/
│   │   ├── engine.ts                 Khmer industry-aware question plan + synth
│   │   └── llm.ts                    Optional OpenAI-compatible enrichment
│   ├── export/
│   │   ├── ats.ts                    ATS plain-text + JSON exporters (pure)
│   │   └── client.ts                 PDF (print) / PNG (html-to-image) / ATS
│   └── cv-draft.ts                   MakaraCvDraft model + Khmer font registry
├── app/
│   ├── studio/page.tsx               Khmer authoring studio (interview→export)
│   └── api/interview/route.ts        Khmer interview plan + draft synthesis
├── components/
│   ├── interview/KhmerInterviewer.tsx
│   ├── cv/CvDocument.tsx             2D A4 Khmer-safe document
│   └── export/ExportSelector.tsx     PDF / PNG / ATS selector
├── middleware.ts                     Auth interceptor (deterministic JSON 401)
├── templates/registry.ts            2 free + 18 locked template catalog
└── types/cv.ts                       Zod CV input schema + SceneConfig
```

## Security model

| Concern | Mitigation |
|---|---|
| Telegram payload forgery | HMAC-SHA256 over sorted data-check string, `timingSafeEqual` comparison, `auth_date` window of ≤1h |
| Generation bypass via multi-click | Redis `SET NX PX` atomic lock (5s TTL) + Postgres `SELECT … FOR UPDATE` on the user row |
| Streak gaming via timezones | All day comparisons use UTC midnight (`utcDateKey`), never local time |
| Admin link scraping | Plaintext handle stored only as AES-256-GCM ciphertext; 3s hold + SESSION_SECRET-bound HMAC proof required to decrypt |
| Cross-user data leakage | RLS policies on every table; per-request `app.current_user_id` GUC set inside a transaction |
| Session theft | HttpOnly cookie carrying `id.HMAC(id, SESSION_SECRET)`; cookie + DB lookup both required |

## Tests / CI

Lint and typecheck:

```bash
npm run lint
npm run typecheck
```

## Export engine

| Format | Path | How |
|---|---|---|
| **PDF** (vector, A4, Khmer embedded) | `lib/export/client.ts#exportPdf` | `window.print()` over `#cv-print-root`; `@page { size: A4 }` + self-hosted fonts → *Save as PDF* |
| **PNG** (3× raster) | `lib/export/client.ts#exportPng` | `html-to-image` `toPng` at `pixelRatio: 3` |
| **ATS .txt / .json** | `lib/export/ats.ts` | Pure single-column serializers (no tables/columns) |

For fully-automated server-side PDF (e.g. emailing CVs), the same `#cv-print-root`
layout can be driven by Puppeteer/Playwright `page.pdf({ format: 'A4' })` — the
anti-clipping CSS and self-hosted fonts make that a drop-in upgrade.
