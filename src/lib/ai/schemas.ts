import { z } from "zod";

// ---------- Brain shapes (stored as JSON strings on PhotographerProfile) ----------

export const BrandBrainSchema = z
  .object({
    photographerName: z.string().default(""),
    studioName: z.string().default(""),
    location: z.string().default(""),
    category: z.string().default("Wedding photography"),
    targetCustomer: z.string().default(""),
    photographyStyle: z.string().default(""),
    brandPersonality: z.string().default(""),
    values: z.string().default(""),
    toneOfVoice: z.string().default(""),
    languageStyle: z.string().default(""),
    differentiators: z.string().default(""),
    offerings: z.string().default(""), // e.g. actual day, pre-wedding, ROM
  })
  .partial()
  .default({});
export type BrandBrain = z.infer<typeof BrandBrainSchema>;

export const SalesBrainSchema = z
  .object({
    discountRules: z.string().default(""),
    followUpRules: z.string().default(""),
    allowedToSay: z.string().default(""),
    neverSay: z.string().default(""),
    salesPressure: z.string().default("balanced"), // soft | balanced | assertive
    objectionStyle: z.string().default(""),
    styleProfile: z.string().default(""), // synthesized from training examples
    // Business-specific notes layered on top of the baked-in discovery-first
    // and upsell playbooks in prompts.ts (see buildMandySystemPrompt).
    conversationStrategy: z.string().default(""),
    upsellStrategy: z.string().default(""),
    // The photographer's personal working preferences (preferred shoot types,
    // timing, locations, flow, attire, style, communication style, etc.) —
    // defaults Mandy leans on, not hard rules.
    photographerPreferences: z.string().default(""),
  })
  .partial()
  .default({});
export type SalesBrain = z.infer<typeof SalesBrainSchema>;

export const BookingBrainSchema = z
  .object({
    depositAmount: z.string().default(""),
    paymentMethods: z.string().default(""),
    paymentInstructions: z.string().default(""),
    balanceRules: z.string().default(""),
    cancellationPolicy: z.string().default(""),
    consultationRules: z.string().default(""),
    availabilityRules: z.string().default(""),
    humanOnlyTopics: z.string().default(""),
  })
  .partial()
  .default({});
export type BookingBrain = z.infer<typeof BookingBrainSchema>;

export const PackageRulesSchema = z
  .object({
    travelFeeRules: z.string().default(""),
    overtimeFeeRules: z.string().default(""),
  })
  .partial()
  .default({});
export type PackageRules = z.infer<typeof PackageRulesSchema>;

// ---------- AI engine output contract ----------

export const EngineOutputSchema = z.object({
  reply: z.string(),
  detectedLanguage: z.enum(["en", "zh", "ms", "mixed"]).catch("en"),
  extracted: z
    .object({
      customerName: z.string().nullish(),
      eventDate: z.string().nullish(),
      location: z.string().nullish(),
      eventType: z.string().nullish(),
      budgetRange: z.string().nullish(),
      interestedPackage: z.string().nullish(),
    })
    .catch({}),
  suggestedStatus: z.string().nullish(),
  takeover: z
    .object({
      needed: z.boolean().catch(false),
      reason: z.string().nullish(),
    })
    .catch({ needed: false, reason: null }),
  confidence: z.number().min(0).max(1).catch(0.8),
  // Attachment ids (from the package catalog) Mandy wants to send with this
  // reply. Validated server-side against real, tenant-owned attachments.
  sendAttachmentIds: z.array(z.string()).catch([]).default([]),
});
export type EngineOutput = z.infer<typeof EngineOutputSchema>;

// ---------- AI-led setup interview output contract ----------

export const InterviewOutputSchema = z.object({
  reply: z.string(),
  extracted: z
    .object({
      brandBrain: BrandBrainSchema.optional(),
      salesBrain: SalesBrainSchema.optional(),
      bookingBrain: BookingBrainSchema.optional(),
      packageRules: PackageRulesSchema.optional(),
    })
    .catch({}),
  readyToWrapUp: z.boolean().catch(false),
});
export type InterviewOutput = z.infer<typeof InterviewOutputSchema>;
