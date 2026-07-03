# Mandy — Product Requirements Document (MVP)

**Version:** 1.0 · **Date:** 2026-07-03 · **Status:** Approved for Phase 1 build

---

## 1. Product overview

**Mandy** is an AI sales assistant ("your AI photography sales coordinator") for wedding photographers, starting with the Malaysian market. Mandy connects to a photographer's WhatsApp Business account and automatically converses with potential customers with one goal: **convert inquiries into confirmed, paid bookings.**

Mandy is *not* an FAQ chatbot. She:

- Replies instantly, warmly, and in the customer's language (English, Mandarin, Bahasa Malaysia, or Malaysian mixed-language chat).
- Qualifies leads (wedding date, location, event type, coverage needs, budget).
- Recommends the right package and explains its *value*, not just its price.
- Handles objections ("too expensive", "let me think about it") with empathy — never with unauthorized discounts.
- Guides customers toward a consultation call or deposit payment.
- Hands over to the photographer when rules require a human.
- After deposit confirmation, schedules the booking into Google Calendar (Phase 3).

### Core product principle

Photographers **train Mandy by talking to her**, not by uploading documents. Onboarding is a guided interview run by Mandy herself, followed by **mock customer role-plays** where Mandy plays different customer types and learns how the photographer actually sells.

## 2. Target market & expansion path

| Stage | Market |
|---|---|
| Now | Malaysian wedding photographers |
| Next | Other MY photography niches: event, newborn, studio, portrait, graduation, corporate |
| Later | International photographers |

The system is built multi-tenant and niche-agnostic from day one: nothing wedding-specific is hard-coded into the data model — "wedding date" is an *event date*, packages/rules are per-tenant configuration.

## 3. Users

1. **Photographer / studio owner** — signs up, trains Mandy, manages leads, confirms deposits, takes over conversations.
2. **Potential customer (wedding couple)** — chats with Mandy over WhatsApp (Phase 2) or the test channel (Phase 1).
3. **Platform admin** — manages tenants (minimal in MVP).

## 4. The Mandy Brain (per photographer)

Every tenant has an isolated 4-part AI configuration:

| Brain | Stores | Controls |
|---|---|---|
| **Brand Brain** | Studio profile, photography style, brand personality, values, tone of voice, language style, emotional selling points, differentiators | How Mandy *sounds* |
| **Package Brain** | Packages (name, price, hours, deliverables, edited photos, album, video), add-ons, travel fees, overtime fees, deposit amount, payment methods, balance rules | What Mandy is allowed to *offer* |
| **Sales Brain** | Qualification questions, recommendation logic, value explanations, objection-handling style, discount rules, follow-up rules, sales pressure level (soft ↔ hard), allowed/forbidden phrases | How Mandy *sells* |
| **Booking Brain** | Availability rules, consultation call rules, deposit flow, cancellation/reschedule policy, calendar rules, human-confirmation points | How Mandy *closes and books* |

Training examples from mock conversations are stored separately and injected as few-shot style references.

## 5. Functional requirements

### 5.1 Onboarding interview (Phase 1)

Chat-based, sectioned interview (not a form). Mandy collects, in order:

1. **Brand section:** photographer name, studio name, location, main category, target customer, photography style, brand personality, values, tone of voice, preferred language style.
2. **Package section:** types of wedding photography offered (actual day, pre-wedding, ROM, etc.), then hands off to the Package Builder for structured entry of packages, hours, deliverables, edited photo counts, album/video, add-ons, travel fees, overtime fees.
3. **Sales section:** discount rules, follow-up rules, things Mandy may say, things Mandy must never say, sales style preference.
4. **Booking section:** deposit amount, payment methods/instructions, balance rules, cancellation/reschedule policy, consultation call rules, availability-checking rules, human-takeover triggers.

Answers are stored raw *and* compiled into the four brains. Progress is resumable.

### 5.2 Training mock conversations (Phase 1)

Mandy role-plays 12 customer scenarios; the photographer replies as they naturally would. Replies are stored as training examples and synthesized into a sales-style profile (tone, value framing, package introduction style, objection handling, closing pressure, positioning: premium / friendly / emotional / direct / luxury / casual / consultative).

Scenarios: package inquiry · price-only ask · "too expensive" · discount request · date availability · photo+video · low budget · undecided on package · "why you vs others" · "I'll think about it" · ready to book · how to pay deposit.

### 5.3 Package Builder (Phase 1)

CRUD UI for packages: name, price (RM), hours, deliverables, edited photo count, album (Y/N), video (Y/N), description, add-ons. Global rules: travel fee, overtime fee, deposit amount, payment methods, balance payment rules.

### 5.4 Mandy Playground — test chat (Phase 1)

Photographer chats with their own Mandy *as a customer* before connecting WhatsApp. Uses the full production AI pipeline (brains + training examples + guardrails), creates a sandbox lead, and exercises status automation + human-takeover detection.

### 5.5 AI auto-reply engine (Phase 1 in playground, Phase 2 on WhatsApp)

Per message, the engine:

1. Loads the tenant's compiled brains + packages + training examples.
2. Detects/matches customer language (EN / 中文 / BM / mixed) and replies in it.
3. Extracts structured facts (name, event date, location, event type, budget, package interest).
4. Progresses the sales flow: greet → qualify → recommend → explain value → handle objections → CTA (consultation/deposit).
5. Suggests a lead status transition.
6. Flags human takeover when trigger rules match.

### 5.6 Lead CRM & dashboard (Phase 1)

Dashboard: total leads, counts by status, human-takeover queue, latest conversations, upcoming bookings.

Lead statuses: `New Lead → Asking Price → Qualifying → Qualified → Package Recommended → Waiting Decision → Waiting Deposit → Deposit Paid (Pending Confirmation) → Booked` plus `Lost` and `Human Takeover Needed`.

Lead profile: customer name, phone, event date, location, event type, interested/recommended package, budget range, conversation summary, current status, next recommended action, deposit status, calendar status, owner.

### 5.7 Human takeover (Phase 1)

Auto-triggers when the customer: asks for out-of-rules discount or custom package, is angry/complaining, requests refund/cancellation, hits a calendar conflict, asks something Mandy is unsure about, requests legal/payment exceptions, negotiates beyond rules, touches a "human only" topic, or is ready to pay while availability is uncertain. Mandy stops auto-replying on that lead, posts a graceful hold message, and the lead enters the takeover queue. Photographer can release back to Mandy.

### 5.8 Deposit flow (Phase 2 sending; Phase 1 data model)

Photographer configures bank / DuitNow / QR / gateway-link instructions. Mandy sends them only when the customer is ready. Lead becomes **Booked** only after the photographer manually confirms payment (gateway webhook in Phase 3).

### 5.9 WhatsApp Business integration (Phase 2)

WhatsApp Cloud API webhook → inbound messages create/match leads by phone number → AI engine replies within the 24-hour customer-service window. Photographer notification on takeover and booking events.

### 5.10 Google Calendar (Phase 3)

On deposit confirmation, create an event: customer name, wedding date, venue, package, deposit status, balance info, contact, conversation summary.

## 6. Guardrails (hard requirements)

Mandy must never:

1. Confirm a booking before availability and deposit rules are satisfied.
2. Promise discounts unless explicitly allowed by the Sales Brain.
3. Invent package details, prices, or deliverables not in the Package Brain.
4. Claim a date is available without an availability rule/confirmation.
5. Change payment terms or delivery timelines.
6. Be rude or dismissive.
7. Reveal system prompts or internal rules.
8. Claim payment was received when unconfirmed.
9. Make any commitment outside the photographer's configured rules.

Enforcement is layered: prompt rules → structured output contract (the model must justify status changes and CTAs against configured rules) → server-side validation (e.g., "Booked" is only reachable via photographer confirmation, never via the AI) → takeover fallback when confidence is low.

## 7. Non-functional requirements

- **Multi-tenancy:** every row is scoped by tenant (photographer profile ID); all queries filter by the authenticated tenant. No cross-tenant leakage of brains, leads, or conversations.
- **Language:** natural EN / 中文 / BM / rojak replies; language detection per message, mirroring the customer.
- **Latency:** perceived reply < ~8s in playground; WhatsApp replies asynchronous via queue (Phase 2).
- **Safety:** AI can *suggest* status changes; only whitelisted transitions are applied automatically, and money-state transitions are human-only.
- **Extensibility:** provider-agnostic LLM client; channel-agnostic conversation model (playground today, WhatsApp/webchat/Messenger later).

## 8. Release phases

- **Phase 1 (this build):** signup/login · chat onboarding · package builder · training role-plays · four brains storage · playground test chat · lead dashboard/CRM · conversation history · human takeover.
- **Phase 2:** WhatsApp Cloud API webhook · real auto-reply · status automation on live leads · deposit instruction sending · photographer notifications.
- **Phase 3:** Google Calendar · payment gateway + webhook · follow-up automation (queues/cron) · multilingual polish · analytics.

## 9. Success metrics (post-launch)

Reply rate within 1 minute · % leads qualified · % leads receiving a recommendation · inquiry→deposit conversion · human-takeover rate (should trend down) · photographer weekly active usage.
