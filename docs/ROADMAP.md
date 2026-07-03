# Mandy — User Flows & Development Milestones

## 1. User flows

### 1.1 Photographer: signup → live Mandy

```
Sign up (email/password)
  → Onboarding interview (chat with Mandy)
      Brand section → Sales section → Booking section
      → "Now let's set up your packages" → Package Builder (structured UI)
  → Training role-plays (12 mock customers, photographer replies naturally)
      → style synthesis → Sales Brain updated
  → Playground: photographer tests Mandy as a fake customer
      → tweak packages / settings → retest
  → [Phase 2] Connect WhatsApp Business → Mandy goes live
```

### 1.2 Customer conversation (the sales flow Mandy drives)

```
1. Customer: "Hi, may I know your wedding package?"
2. Mandy: warm greeting + congratulations → asks event date + location
   + actual-day / pre-wedding / both                          [New Lead → Qualifying]
3. Mandy collects coverage needs, events count, style, photo vs photo+video,
   budget (tactfully, per Sales Brain)                        [→ Qualified]
4. Mandy recommends the best-fit package + explains WHY it fits their day
                                                              [→ Package Recommended]
5. Q&A + objection handling (empathy → value → lighter package if allowed;
   never unauthorized discounts)                              [→ Waiting Decision]
6. CTA: consultation call or deposit                          [→ Waiting Deposit]
7. Mandy sends the photographer's payment instructions (Phase 2 on WhatsApp)
8. Customer pays → photographer confirms manually             [→ Deposit Paid → Booked]
9. [Phase 3] Google Calendar event + confirmation message + photographer notified
```

### 1.3 Human takeover

```
Trigger detected (out-of-rules discount, anger, refund, custom package,
uncertain availability while ready to pay, low confidence, "human only" topic)
  → Mandy sends graceful hold message ("let me check with {photographer}…")
  → Lead status = Human Takeover Needed, auto-reply frozen
  → appears in dashboard takeover queue (+ WhatsApp/email notify in Phase 2)
  → photographer replies manually → releases lead back to Mandy
```

### 1.4 Deposit & booking (MVP-manual)

```
Customer ready → Mandy sends configured payment instructions
  → depositStatus = INSTRUCTIONS_SENT → customer transfers
  → photographer sees claim, verifies bank/DuitNow → clicks "Confirm deposit"
  → status = Booked (only a human can set money states)
  → [Phase 3] calendar event + gateway webhook automates this
```

## 2. MVP feature list (Phase 1 — this build)

1. Email/password signup & login (Auth.js, JWT)
2. Chat-based onboarding interview (4 sections, resumable, answers → brains)
3. Package Builder (packages CRUD + travel/overtime/deposit/payment rules)
4. Training role-plays (12 scenarios → stored examples → style synthesis)
5. Brain storage: Brand / Package / Sales / Booking, tenant-isolated
6. Mandy Playground: full-pipeline test chat creating sandbox leads
7. Lead dashboard: counts by status, takeover queue, recent conversations
8. Lead CRM: list, filters, lead profile, manual status & deposit confirmation
9. Conversation history per lead
10. Human takeover: AI-triggered flag + manual take/release

## 3. Development milestones

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| M1 | Foundation | Next.js scaffold, Prisma schema, migrations, seed, Auth.js signup/login, protected layout | Can register, log in, see empty dashboard |
| M2 | Onboarding | Interview steps engine, chat UI, answer storage, brain compiler | Full interview completes; brains populated |
| M3 | Packages | Package CRUD UI + rules editor | Packages appear in compiled Package Brain |
| M4 | Training | Scenario runner, example storage, style synthesis | 12 scenarios complete; styleProfile saved |
| M5 | AI engine + Playground | Prompt compiler, LLM client, output contract, guardrail layer, playground chat, sandbox leads | Mandy sells correctly in EN/中文/BM/mixed; takeover triggers work |
| M6 | CRM | Dashboard, leads list, lead detail, history, status/deposit/takeover actions | End-to-end demo: onboard → train → test-sell → lead appears → confirm deposit → Booked |
| M7 (P2) | WhatsApp | Cloud API webhook, phone-matched leads, live auto-reply, notifications | Real customer conversation handled |
| M8 (P3) | Booking + growth | Google Calendar, payment webhook, follow-up jobs, analytics | Deposit → calendar event automated |

## 4. Environment & configuration

```
DATABASE_URL         file:./dev.db (dev) | postgres://... (prod)
AUTH_SECRET          Auth.js JWT secret
LLM_PROVIDER         anthropic (default) | openai
ANTHROPIC_API_KEY    used when provider=anthropic (model: claude-sonnet-5)
OPENAI_API_KEY       used when provider=openai
MANDY_LLM_MODEL      optional model override
```

The app runs without an LLM key: onboarding, training, packages and CRM are fully functional (deterministic fallbacks); only the Playground requires a key.
