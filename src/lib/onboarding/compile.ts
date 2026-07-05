import type { PhotographerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseJson, toJson } from "@/lib/json";

// Deterministic mapping of raw interview answers → the four brains.
// Each key is an onboarding step id (see steps.ts).
export async function compileBrains(profile: PhotographerProfile): Promise<void> {
  const a = parseJson<Record<string, string>>(profile.onboardingAnswers, {});

  const brandBrain = {
    photographerName: a.photographerName ?? "",
    studioName: a.studioName ?? "",
    location: a.location ?? "",
    category: a.category ?? "",
    targetCustomer: a.targetCustomer ?? "",
    photographyStyle: a.photographyStyle ?? "",
    brandPersonality: a.brandPersonality ?? "",
    values: a.values ?? "",
    toneOfVoice: a.toneOfVoice ?? "",
    languageStyle: a.languageStyle ?? "",
    differentiators: a.differentiators ?? "",
    offerings: a.offerings ?? "",
  };

  const salesBrain = {
    ...parseJson<Record<string, string>>(profile.salesBrain, {}), // keep styleProfile if set
    discountRules: a.discountRules ?? "",
    followUpRules: a.followUpRules ?? "",
    allowedToSay: a.allowedToSay ?? "",
    neverSay: a.neverSay ?? "",
    salesPressure: normalizePressure(a.salesPressure),
    conversationStrategy: a.conversationStrategy ?? "",
    upsellStrategy: a.upsellStrategy ?? "",
  };

  const bookingBrain = {
    depositAmount: a.depositAmount ?? "",
    paymentMethods: a.paymentMethods ?? "",
    paymentInstructions: a.paymentInstructions ?? "",
    balanceRules: a.balanceRules ?? "",
    cancellationPolicy: a.cancellationPolicy ?? "",
    consultationRules: a.consultationRules ?? "",
    availabilityRules: a.availabilityRules ?? "",
    humanOnlyTopics: a.humanOnlyTopics ?? "",
  };

  const packageRules = {
    travelFeeRules: a.travelFeeRules ?? "",
    overtimeFeeRules: a.overtimeFeeRules ?? "",
  };

  const [city, state] = (a.location ?? "").split(",").map((s) => s.trim());

  await prisma.photographerProfile.update({
    where: { id: profile.id },
    data: {
      photographerName: a.photographerName || profile.photographerName,
      studioName: a.studioName || profile.studioName,
      city: city || profile.city,
      state: state || profile.state,
      brandBrain: toJson(brandBrain),
      salesBrain: toJson(salesBrain),
      bookingBrain: toJson(bookingBrain),
      packageRules: toJson(packageRules),
    },
  });
}

// Photographer may answer in EN/ZH/MS ("soft"/"温和"/"lembut", etc.) — match
// keywords from all three so the pressure setting isn't silently dropped.
function normalizePressure(raw: string | undefined): string {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("soft") || v.includes("温和") || v.includes("lembut")) return "soft";
  if (v.includes("assert") || v.includes("hard") || v.includes("积极") || v.includes("agresif")) return "assertive";
  return "balanced";
}
