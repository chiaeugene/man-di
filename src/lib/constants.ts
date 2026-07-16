// Canonical values for the string-encoded enums in prisma/schema.prisma.

export const LEAD_STATUSES = [
  "New Lead",
  "Asking Price",
  "Qualifying",
  "Qualified",
  "Package Recommended",
  "Waiting Decision",
  "Waiting Deposit",
  "Deposit Paid",
  "Booked",
  "Lost",
  "Human Takeover Needed",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Transitions Mandy (the AI) may apply on her own. Money states are human-only:
// "Deposit Paid" and "Booked" can only be set by the photographer via the CRM.
export const AI_ALLOWED_STATUSES: LeadStatus[] = [
  "Asking Price",
  "Qualifying",
  "Qualified",
  "Package Recommended",
  "Waiting Decision",
  "Waiting Deposit",
  "Lost",
  "Human Takeover Needed",
];

export const DEPOSIT_STATUSES = [
  "NONE",
  "INSTRUCTIONS_SENT",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

// PLAYGROUND is live today; WHATSAPP/INSTAGRAM/MESSENGER are reserved for
// Phase 2 channel integrations (see docs/ROADMAP.md) — declared now so the
// UI's channel labeling (src/lib/channels.ts) is ready before they're wired up.
export const CONVERSATION_KINDS = [
  "ONBOARDING",
  "TRAINING",
  "PLAYGROUND",
  "WHATSAPP",
  "INSTAGRAM",
  "MESSENGER",
] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

// Same set as CONVERSATION_KINDS, minus the internal-only kinds — this is
// what a Lead.source can be.
export const LEAD_SOURCES = ["PLAYGROUND", "WHATSAPP", "INSTAGRAM", "MESSENGER"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const MESSAGE_ROLES = ["CUSTOMER", "MANDY", "PHOTOGRAPHER", "SYSTEM"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const ONBOARDING_STATUSES = ["NOT_STARTED", "INTERVIEW", "TRAINING", "COMPLETED"] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const CAMPAIGN_STATUSES = ["DRAFT", "SENDING", "SENT", "FAILED"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

// Lead statuses that must never receive an automated follow-up or campaign
// nudge — either the deal is closed, or a human is already handling it.
export const FOLLOWUP_EXCLUDED_STATUSES: LeadStatus[] = [
  "Deposit Paid",
  "Booked",
  "Lost",
  "Human Takeover Needed",
];
