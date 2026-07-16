import type { Lead, PhotographerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/json";
import { chatComplete, llmConfigured } from "@/lib/ai/llm";
import { BrandBrainSchema, SalesBrainSchema } from "@/lib/ai/schemas";
import { parseJson } from "@/lib/json";
import { FOLLOWUP_EXCLUDED_STATUSES } from "@/lib/constants";
import { sendWhatsAppText } from "@/lib/whatsapp/client";

// Code defaults when a profile hasn't set explicit values.
const DEFAULT_FOLLOWUP_HOURS = 20;
const DEFAULT_FOLLOWUP_MAX_COUNT = 2;

// WhatsApp only allows a free-form text message within 24h of the customer's
// last message (Meta's "customer service window") — outside it, a message
// requires a pre-approved template, which this codebase doesn't implement.
// Capping here keeps every automated nudge inside that window.
const MAX_SAFE_FOLLOWUP_HOURS = 20;

function followUpHoursFor(profile: PhotographerProfile): number {
  const configured = profile.followUpHours ?? DEFAULT_FOLLOWUP_HOURS;
  return Math.min(configured, MAX_SAFE_FOLLOWUP_HOURS);
}

function followUpMaxCountFor(profile: PhotographerProfile): number {
  return profile.followUpMaxCount ?? DEFAULT_FOLLOWUP_MAX_COUNT;
}

async function generateFollowUpMessage(profile: PhotographerProfile, lead: Lead): Promise<string> {
  const brand = BrandBrainSchema.parse(parseJson(profile.brandBrain, {}));
  const sales = SalesBrainSchema.parse(parseJson(profile.salesBrain, {}));
  const studioName = brand.studioName || profile.studioName || "the studio";

  const fallback = lead.customerName
    ? `Hi ${lead.customerName}! Just checking in — are you still interested in booking with ${studioName}? Happy to answer any questions 😊`
    : `Hi there! Just checking in — are you still interested in booking with ${studioName}? Happy to answer any questions 😊`;

  if (!llmConfigured()) return fallback;

  try {
    const raw = await chatComplete({
      system: `You write ONE short, warm re-engagement WhatsApp message for a photography studio's CRM, following up with a lead who has gone quiet. Studio: ${studioName}. Tone of voice: ${brand.toneOfVoice || "friendly, warm"}. Follow-up guidance from the photographer: ${sales.followUpRules || "none — use your best judgment, keep it low-pressure"}. Rules: 1-2 sentences max, no pressure or urgency tactics, do not invent prices/availability/facts not given below, end with a light open question. Respond with ONLY the message text, nothing else — no quotes, no preamble.`,
      messages: [
        {
          role: "user",
          content: `Lead context — name: ${lead.customerName || "unknown"}, event type: ${lead.eventType || "unknown"}, event date discussed: ${lead.eventDate || "not yet set"}, last known summary: ${lead.summary || "no summary yet"}. This is automated follow-up #${lead.followUpCount + 1} after a period of silence. Write the message.`,
        },
      ],
      maxTokens: 200,
      temperature: 0.6,
    });
    const text = raw.trim();
    return text.length > 0 && text.length < 600 ? text : fallback;
  } catch (err) {
    console.error("[followups] generateFollowUpMessage failed, using fallback (non-fatal)", err);
    return fallback;
  }
}

export type FollowUpRunResult = { checked: number; sent: number; escalated: number; skipped: number };

// Core no-reply follow-up sweep for one profile. Callable from the cron route
// and from manual test scripts — same logic either way.
export async function runFollowUps(profile: PhotographerProfile): Promise<FollowUpRunResult> {
  const result: FollowUpRunResult = { checked: 0, sent: 0, escalated: 0, skipped: 0 };
  if (!profile.followUpEnabled) return result;

  const hoursThreshold = followUpHoursFor(profile);
  const maxCount = followUpMaxCountFor(profile);
  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      profileId: profile.id,
      needsHuman: false,
      status: { notIn: FOLLOWUP_EXCLUDED_STATUSES },
      conversation: { isNot: null },
    },
    include: { conversation: true },
  });

  for (const lead of leads) {
    if (!lead.conversation) continue;
    result.checked++;

    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: lead.conversation.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    // No messages, or the customer spoke last — nothing to nudge.
    if (!lastMessage || lastMessage.role === "CUSTOMER") {
      result.skipped++;
      continue;
    }
    if (lastMessage.createdAt > cutoff) {
      result.skipped++;
      continue;
    }
    // Already nudged inside this same silence window — don't double-send.
    if (lead.lastFollowUpAt && lead.lastFollowUpAt > cutoff) {
      result.skipped++;
      continue;
    }

    if (lead.followUpCount >= maxCount) {
      // Given up on automation — hand back to the photographer instead of
      // going silent forever.
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          needsHuman: true,
          takeoverReason: `No response after ${maxCount} automated follow-up${maxCount === 1 ? "" : "s"} — consider reaching out personally.`,
        },
      });
      result.escalated++;
      continue;
    }

    const text = await generateFollowUpMessage(profile, lead);

    await prisma.message.create({
      data: {
        conversationId: lead.conversation.id,
        role: "MANDY",
        content: text,
        meta: toJson({ automatedFollowUp: true, followUpNumber: lead.followUpCount + 1 }),
      },
    });
    await prisma.conversation.update({
      where: { id: lead.conversation.id },
      data: { updatedAt: new Date() },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastFollowUpAt: new Date(), followUpCount: { increment: 1 } },
    });

    if (lead.conversation.kind === "WHATSAPP" && lead.phone && profile.whatsappPhoneId) {
      await sendWhatsAppText(profile.whatsappPhoneId, lead.phone, text, profile.whatsappAccessToken);
    }

    result.sent++;
  }

  return result;
}

// Runs the sweep for every profile with follow-ups enabled. Used by the cron
// route — one call covers every tenant.
export async function runFollowUpsForAllProfiles(): Promise<Record<string, FollowUpRunResult>> {
  const profiles = await prisma.photographerProfile.findMany({ where: { followUpEnabled: true } });
  const results: Record<string, FollowUpRunResult> = {};
  for (const profile of profiles) {
    results[profile.id] = await runFollowUps(profile);
  }
  return results;
}
