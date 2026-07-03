# Mandy — AI Photography Sales Coordinator (MVP, Phase 1)

Mandy is an AI sales assistant for wedding photographers (starting with Malaysia). She learns each photographer's brand, packages, sales rules, and booking workflow through a **conversational onboarding interview** and **mock-customer role-plays**, then sells on their behalf — qualifying leads, recommending packages, handling objections, and guiding customers to deposit.

Design docs live in [`docs/`](docs): [PRD](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap & flows](docs/ROADMAP.md) · [Deployment](docs/DEPLOYMENT.md).

## Quick start

```bash
npm install
cp .env.example .env         # fill in DATABASE_URL/DIRECT_URL (Supabase) + AUTH_SECRET
npx prisma migrate deploy    # applies migrations to your Postgres database
npm run db:seed              # demo account with full data (optional)
npm run dev                  # http://localhost:3000
```

**Demo login (after seeding):** `demo@mandy.my` / `mandy1234` — a fully onboarded studio with packages, training examples, and sample leads across the pipeline.

## Enabling the AI (playground)

Everything except the "Test Mandy" playground works without an API key. To chat with Mandy, edit `.env`:

```
LLM_PROVIDER="anthropic"          # or "openai"
ANTHROPIC_API_KEY="sk-ant-..."    # model defaults to claude-sonnet-5
```

Restart the dev server after changing `.env`.

## What's in Phase 1

- Email/password auth (Auth.js v5, JWT)
- Chat-based onboarding interview (27 questions → Brand/Sales/Booking brains), available in English, 中文, and Bahasa Malaysia
- Package Builder + travel/overtime fee rules (Package Brain)
- 12 training role-plays → stored style examples + synthesized style profile
- Playground test chat using the full production AI pipeline (creates sandbox leads)
- Lead CRM: dashboard counts, pipeline filters, lead profiles, conversation history
- Human takeover: AI-triggered freeze + manual take/release; money states (Deposit Paid, Booked) are photographer-only
- Restart-onboarding (Settings > Danger zone) so a photographer can redo the interview

## Architecture notes

- **Multi-tenant:** every query is scoped through `requireProfile()` (`src/lib/tenant.ts`).
- **AI engine:** `src/lib/ai/engine.ts` — compiles a per-tenant system prompt from the four brains (`prompts.ts`), enforces a JSON output contract (`schemas.ts`), and applies only whitelisted side effects server-side (`constants.ts`).
- **Database:** Postgres (Supabase) for both dev and prod. JSON fields are stored as strings for portability across providers.
- **i18n:** `src/lib/i18n/` — cookie-persisted locale, EN/中文/BM dictionaries, `useI18n()` on the client and `getServerT()` on the server. Onboarding questions and training scenarios are also localized (`src/lib/onboarding/steps.ts`, `src/lib/training/scenarios.ts`).
- **Phase 2 (WhatsApp Cloud API)** plugs into the same engine: `generateMandyReply()` is channel-agnostic; conversations already carry a `kind` (`PLAYGROUND` | `WHATSAPP` | ...).

## Deploying

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full GitHub → Supabase → Render walkthrough. Short version: `render.yaml` in this folder is a Render Blueprint — push to GitHub, create a Supabase Postgres project, then "New > Blueprint" on Render and paste in the secrets.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run db:migrate:deploy` | Apply pending migrations (used on Render at boot) |
| `npm run db:seed` | Seed demo tenant (skips if it exists) — dev/demo only, don't run against a real production tenant's data |
| `npx prisma studio` | Browse the database |
