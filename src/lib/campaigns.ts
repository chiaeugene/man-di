import type { Campaign, PhotographerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toJson, parseJson } from "@/lib/json";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { FOLLOWUP_EXCLUDED_STATUSES } from "@/lib/constants";

export type CampaignAudience = { statuses?: string[]; sources?: string[] };

// Resolves a campaign's audience filter to the actual lead rows it would
// reach right now. Recipients are always leads still in an active pipeline
// state — closed-out leads (Booked/Lost/Deposit Paid) or leads already flagged
// for the photographer are never a valid broadcast target.
export async function resolveAudience(profile: PhotographerProfile, audience: CampaignAudience) {
  const where: Record<string, unknown> = {
    profileId: profile.id,
    needsHuman: false,
    status: { notIn: FOLLOWUP_EXCLUDED_STATUSES },
  };
  if (audience.statuses && audience.statuses.length > 0) {
    // Intersect with the exclusion list rather than replacing it — an
    // explicitly-selected "Booked" must still never be broadcast to.
    const allowed = audience.statuses.filter(
      (s) => !(FOLLOWUP_EXCLUDED_STATUSES as readonly string[]).includes(s)
    );
    where.status = { in: allowed };
  }
  if (audience.sources && audience.sources.length > 0) {
    where.source = { in: audience.sources };
  }
  return prisma.lead.findMany({ where, include: { conversation: true } });
}

function personalize(template: string, customerName: string | null): string {
  return template.replace(/\{\{\s*customerName\s*\}\}/gi, customerName || "there");
}

export type CampaignSendResult = { recipientCount: number; sentCount: number; failedCount: number };

// Sends a DRAFT campaign now. Only leads with a WHATSAPP conversation + phone
// number actually receive a message (no other channel is wired up for
// outbound sends yet) — every other matched lead is counted in
// recipientCount but not sentCount, and the campaign record makes that gap
// visible rather than silently claiming a full send.
export async function sendCampaign(profile: PhotographerProfile, campaign: Campaign): Promise<CampaignSendResult> {
  const audience = parseJson<CampaignAudience>(campaign.audience, {});
  const leads = await resolveAudience(profile, audience);

  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENDING" } });

  let sentCount = 0;
  let failedCount = 0;

  for (const lead of leads) {
    const text = personalize(campaign.message, lead.customerName);
    const canSend = lead.conversation && lead.conversation.kind === "WHATSAPP" && lead.phone && profile.whatsappPhoneId;

    if (canSend && lead.conversation) {
      await sendWhatsAppText(profile.whatsappPhoneId!, lead.phone!, text, profile.whatsappAccessToken);
      await prisma.message.create({
        data: {
          conversationId: lead.conversation.id,
          role: "MANDY",
          content: text,
          meta: toJson({ campaignId: campaign.id, campaignName: campaign.name }),
        },
      });
      await prisma.conversation.update({
        where: { id: lead.conversation.id },
        data: { updatedAt: new Date() },
      });
      sentCount++;
    } else {
      failedCount++;
    }
  }

  const result: CampaignSendResult = { recipientCount: leads.length, sentCount, failedCount };

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: sentCount > 0 ? "SENT" : "FAILED",
      recipientCount: result.recipientCount,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      sentAt: new Date(),
    },
  });

  return result;
}
