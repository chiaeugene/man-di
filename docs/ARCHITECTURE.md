# Mandy — Architecture, Database Schema, API & AI Prompt Design

## 1. Tech stack (decision)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One codebase for UI + API routes + webhooks; first-class Vercel/Node deploy |
| UI | **Tailwind CSS v4** | Fast, consistent, no design-system overhead for MVP |
| Database | **PostgreSQL (Supabase)** via **Prisma ORM** | Same database for dev and prod; managed, persistent across deploys/restarts (see `docs/DEPLOYMENT.md`) |
| Auth | **Auth.js (NextAuth v5), credentials + JWT sessions** | Simple email/password for MVP; OAuth providers can be added later |
| AI | **Provider-agnostic LLM client — Anthropic Claude (default, `claude-sonnet-5`) or OpenAI, selected by `LLM_PROVIDER` env** | Claude is strong at multilingual, persona-faithful, instruction-dense conversation (ideal for rojak-style Malaysian chat + guardrails). The abstraction keeps the vendor swappable |
| Validation | **Zod** | Request validation + safe parsing of the AI's structured output |
| WhatsApp (P2) | WhatsApp Business **Cloud API** webhooks | Official Meta API; no Baileys/unofficial-client ban risk |
| Calendar (P3) | Google Calendar API (OAuth per photographer) | |
| Payments (P3) | Stripe / local gateway (Billplz, toyyibPay, senangPay) webhook | MVP uses manual confirmation |
| Jobs (P2/3) | Vercel Cron or BullMQ + Redis for follow-ups & webhook processing | Not needed in Phase 1 |

## 2. System architecture

```
                                ┌────────────────────────────────────────┐
 Photographer (browser)         │              Next.js app               │
 ──────────────────────────────▶│  UI pages          API route handlers  │
   dashboard / onboarding /     │  /dashboard        /api/onboarding/*   │
   training / playground /      │  /onboarding       /api/training/*     │
   packages / leads / settings  │  /training         /api/playground/*   │
                                │  /playground       /api/packages/*     │
 Customer (WhatsApp, Phase 2)   │  /leads            /api/leads/*        │
 ──────────────────────────────▶│  /settings         /api/whatsapp/webhook (P2)
                                └───────┬───────────────────┬────────────┘
                                        │                   │
                              ┌─────────▼────────┐  ┌───────▼─────────────┐
                              │  Prisma / SQL DB │  │  Mandy AI Engine    │
                              │  (tenant-scoped) │  │  lib/ai/*           │
                              └──────────────────┘  │  - prompt compiler  │
                                                    │  - LLM client       │
                                                    │  - output contract  │
                                                    │  - guardrail layer  │
                                                    └───────┬─────────────┘
                                                    ┌───────▼─────────────┐
                                                    │ Anthropic / OpenAI  │
                                                    └─────────────────────┘
```

**Tenant isolation:** the JWT carries `userId`; every handler resolves the caller's `PhotographerProfile` and scopes every query by `profileId`. There are no unscoped reads of brains, packages, leads, or messages. (Row-level security can be added when moving to hosted Postgres.)

**Conversation channels** are a first-class dimension (`ONBOARDING | TRAINING | PLAYGROUND | WHATSAPP`), so Phase 2 plugs WhatsApp into the same engine and history model that the playground already exercises.

## 3. Database schema

Written for Prisma; string-encoded enums are used instead of native Postgres enums so new statuses never require a migration.

```
User                1 ── 1  PhotographerProfile
PhotographerProfile 1 ── n  Package, TrainingExample, Lead, Conversation
Lead                1 ── 1  Conversation (customer channels)
Conversation        1 ── n  Message
```

### Tables

**User** — `id, email (unique), passwordHash, name, createdAt`

**PhotographerProfile** (the tenant)
- Identity: `id, userId (unique), photographerName, studioName, city, state, country`
- Onboarding: `onboardingStatus (NOT_STARTED|INTERVIEW|TRAINING|COMPLETED)`, `onboardingStep`, `onboardingAnswers Json` (raw interview answers keyed by step)
- Brains: `brandBrain Json`, `salesBrain Json`, `bookingBrain Json` (Package Brain = `Package` rows + `packageRules Json` for travel/overtime/deposit/payment/balance rules)
- P2/P3 stubs: `whatsappPhoneId`, `googleCalendarConnected`

**Package** — `id, profileId, name, priceMyr, hours, editedPhotos, includesAlbum, includesVideo, deliverables Json (string[]), addOns Json ({name, priceMyr}[]), description, isActive, sortOrder`

**TrainingExample** — `id, profileId, scenarioKey, customerMessage, photographerReply, createdAt`

**Lead** — `id, profileId, source (PLAYGROUND|WHATSAPP), customerName?, phone?, eventDate?, location?, eventType?, budgetRange?, interestedPackageId?, recommendedPackageId?, status (see PRD list), depositStatus (NONE|INSTRUCTIONS_SENT|PENDING_CONFIRMATION|CONFIRMED)`, `calendarStatus (NONE|CREATED)`, `summary?, nextAction?, needsHuman, takeoverReason?, createdAt, updatedAt`

**Conversation** — `id, profileId, kind (ONBOARDING|TRAINING|PLAYGROUND|WHATSAPP), leadId? (unique), createdAt, updatedAt`

**Message** — `id, conversationId, role (CUSTOMER|MANDY|PHOTOGRAPHER|SYSTEM), content, meta Json? (extracted facts, status suggestion, takeover verdict), createdAt`

### Brain JSON shapes (Zod-validated)

```ts
BrandBrain   { photographerName, studioName, location, category, targetCustomer,
               photographyStyle, brandPersonality, values, toneOfVoice,
               languageStyle, differentiators, styleSummary? }
SalesBrain   { discountRules, followUpRules, allowedToSay[], neverSay[],
               salesPressure ('soft'|'balanced'|'assertive'), objectionStyle?,
               styleProfile? (synthesized from training examples) }
BookingBrain { depositAmount, paymentMethods, paymentInstructions, balanceRules,
               cancellationPolicy, consultationRules, availabilityRules,
               humanOnlyTopics[] }
PackageRules { travelFeeRules, overtimeFeeRules }   // stored on profile
```

## 4. API route structure

All routes require an authenticated session except `register` and NextAuth. Every handler is tenant-scoped.

```
POST  /api/register                      create user + empty profile
GET/POST /api/auth/[...nextauth]         Auth.js (credentials)

GET   /api/onboarding                    current step, transcript, progress
POST  /api/onboarding/message            { message } → save answer, advance, next Mandy question
POST  /api/onboarding/complete           compile answers → brains

GET   /api/training                      next scenario + progress + transcript
POST  /api/training/message              { scenarioKey, reply } → store example, next scenario
POST  /api/training/synthesize           LLM pass → salesBrain.styleProfile

GET/POST        /api/packages            list / create
PATCH/DELETE    /api/packages/[id]
GET/PUT         /api/package-rules       travel, overtime (Package Brain globals)

POST  /api/playground/session            create sandbox lead + conversation
POST  /api/playground/message            { conversationId, message } → Mandy reply (full AI pipeline)

GET   /api/leads?status=                 list (dashboard + CRM)
GET   /api/leads/[id]                    profile + conversation
PATCH /api/leads/[id]                    manual edits: status, deposit confirm, fields
POST  /api/leads/[id]/takeover           { action: 'take'|'release' }

GET/PUT /api/settings                    brand/sales/booking brain edits, payment instructions

POST  /api/whatsapp/webhook              (Phase 2) Meta webhook verify + inbound
```

**Status-transition safety:** `PATCH /api/leads/[id]` accepts any status from the photographer. The AI path may only auto-apply transitions on a whitelist (e.g. `New Lead→Qualifying`, `Qualified→Package Recommended`, `*→Human Takeover Needed`); `Deposit Paid`/`Booked` are photographer-only.

## 5. AI prompt architecture

### 5.1 Prompt compiler (`lib/ai/prompts.ts`)

The customer-facing system prompt is compiled per tenant, per message, from five blocks:

```
[1 IDENTITY]    Mandy, sales coordinator for {studio}; persona from Brand Brain
                (tone, personality, values, language style, differentiators)
[2 CATALOG]     Package Brain rendered as a fact sheet: packages, prices, hours,
                deliverables, add-ons, travel/overtime rules, deposit & payment rules.
                "This is the ONLY source of truth. Never invent or alter it."
[3 SALES PLAYBOOK]  Sales Brain: qualification checklist (date → location → event type
                → coverage → photo/video → budget), recommendation logic, value-first
                explanations, objection handling per configured style, discount rules,
                CTA policy (consultation/deposit), pressure level.
[4 STYLE EXAMPLES]  Up to 12 few-shot pairs from TrainingExamples:
                "Customer: … / {photographerName} replied: …" with instruction to
                match voice, not copy verbatim.
[5 GUARDRAILS + OUTPUT CONTRACT]  The 9 hard rules (PRD §6), language-mirroring rule,
                takeover triggers, and the JSON output schema.
```

### 5.2 Output contract

The model must return JSON (Zod-parsed, with fallback to plain text if parsing fails):

```json
{
  "reply": "customer-facing text, in the customer's language",
  "detectedLanguage": "en|zh|ms|mixed",
  "extracted": { "customerName": "...", "eventDate": "...", "location": "...",
                  "eventType": "...", "budgetRange": "...", "interestedPackage": "..." },
  "suggestedStatus": "Qualifying",
  "takeover": { "needed": false, "reason": null },
  "confidence": 0.9
}
```

Server-side, `extracted` fields patch the lead (only filling blanks or on higher confidence), `suggestedStatus` is applied only if whitelisted, and `takeover.needed || confidence < threshold` freezes auto-reply and queues the lead for the photographer.

### 5.3 Other prompts

- **Onboarding acknowledgments** — small, optional LLM call to phrase Mandy's warm reaction to each answer (deterministic canned fallback keeps onboarding functional without an API key).
- **Style synthesis** — after training, one LLM pass over the 12 examples → `salesBrain.styleProfile` (tone descriptors, value-framing patterns, objection approach, closing pressure, positioning archetype).
- **Conversation summary** — periodic pass to refresh `lead.summary` and `nextAction`.

### 5.4 Language behavior

No hard-coded translations. The prompt instructs: *detect the language mix of the customer's latest messages and mirror it naturally — Malaysian English ("can", "lah" where natural), Mandarin (simplified, Malaysian usage), Bahasa Malaysia, or mixed code-switching. Warm, local, professional; never textbook-stiff.* `detectedLanguage` is recorded per message for analytics.

## 6. Directory layout (app)

```
mandy/
  prisma/schema.prisma, seed.ts
  src/
    app/(auth)/login, signup
    app/(app)/dashboard, onboarding, training, playground, packages, leads, leads/[id], settings
    app/api/...                     (routes per §4)
    lib/
      auth.ts, prisma.ts, tenant.ts (session → profile resolution)
      ai/llm.ts (provider-agnostic client), prompts.ts, engine.ts (reply pipeline), schemas.ts
      onboarding/steps.ts, compile.ts
      training/scenarios.ts
      leads/status.ts (status list + transition whitelist)
    components/ (chat UI, lead cards, status badges, nav)
```
