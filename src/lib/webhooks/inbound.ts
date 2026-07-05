import type { PhotographerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateMandyReply, recordExchange, refreshLeadSummary } from "@/lib/ai/engine";
import type { LeadSource } from "@/lib/constants";

// Channel-agnostic core: WhatsApp today, Instagram/Messenger can reuse this
// unchanged later. Runs the exact same generateMandyReply/recordExchange
// pipeline Playground already uses — a new channel, not a new sales brain.
export async function handleInboundMessage(opts: {
  profile: PhotographerProfile;
  source: LeadSource;
  externalContactId: string; // e.g. WhatsApp wa_id (phone number)
  externalMessageId: string; // e.g. WhatsApp wamid — used for dedupe
  customerMessage: string;
}): Promise<{ reply: string; attachmentIds: string[] } | null> {
  const { profile, source, externalContactId, externalMessageId, customerMessage } = opts;

  // Meta redelivers webhook events aggressively; never process the same
  // message twice (would double-reply and duplicate the conversation).
  const already = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
  if (already) return null;

  let lead = await prisma.lead.findFirst({
    where: { profileId: profile.id, phone: externalContactId, source },
    include: { conversation: true },
  });
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        profileId: profile.id,
        phone: externalContactId,
        source,
        conversation: { create: { profileId: profile.id, kind: source } },
      },
      include: { conversation: true },
    });
  }
  if (!lead.conversation) {
    lead = {
      ...lead,
      conversation: await prisma.conversation.create({
        data: { profileId: profile.id, kind: source, leadId: lead.id },
      }),
    };
  }
  const conversationId = lead.conversation!.id;

  // Photographer has taken over — record the inbound message so the CRM
  // conversation stays complete, but Mandy stays silent (same guardrail
  // generateMandyReply itself enforces for every other channel).
  if (lead.needsHuman) {
    await prisma.message.create({
      data: { conversationId, role: "CUSTOMER", content: customerMessage, externalId: externalMessageId },
    });
    return null;
  }

  const { output, lead: updatedLead, attachmentIds } = await generateMandyReply({
    profile,
    lead,
    conversationId,
    customerMessage,
  });

  await recordExchange({ conversationId, customerMessage, output, attachmentIds, externalMessageId });

  refreshLeadSummary(profile, updatedLead, conversationId).catch(() => {});

  return { reply: output.reply, attachmentIds };
}

// Records an inbound message the app can't confidently auto-handle (e.g. a
// non-text WhatsApp message type) and hands the lead to the photographer
// rather than guessing — same "when unsure, hand over" philosophy as the
// sales prompt's guardrails.
export async function recordUnhandledInboundMessage(opts: {
  profile: PhotographerProfile;
  source: LeadSource;
  externalContactId: string;
  externalMessageId: string;
  note: string;
}): Promise<void> {
  const { profile, source, externalContactId, externalMessageId, note } = opts;

  const already = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
  if (already) return;

  let lead = await prisma.lead.findFirst({ where: { profileId: profile.id, phone: externalContactId, source } });
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        profileId: profile.id,
        phone: externalContactId,
        source,
        needsHuman: true,
        takeoverReason: note,
        status: "Human Takeover Needed",
        conversation: { create: { profileId: profile.id, kind: source } },
      },
      include: { conversation: true },
    });
  } else {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { needsHuman: true, takeoverReason: note, status: "Human Takeover Needed" },
    });
  }

  const conversation =
    (await prisma.conversation.findFirst({ where: { leadId: lead.id } })) ??
    (await prisma.conversation.create({ data: { profileId: profile.id, kind: source, leadId: lead.id } }));

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "SYSTEM", content: note, externalId: externalMessageId },
  });
}
