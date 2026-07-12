import type { Conversation, Lead, PhotographerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateMandyReply, recordExchange, refreshLeadSummary } from "@/lib/ai/engine";
import type { LeadSource } from "@/lib/constants";
import { parseJson, toJson } from "@/lib/json";
import { BookingBrainSchema } from "@/lib/ai/schemas";
import { verifyPaymentProof, isConfidentPaymentMatch } from "@/lib/ai/vision";
import { confirmDepositAndBook } from "@/lib/leads/confirm-deposit";

type LeadWithConversation = Lead & { conversation: Conversation | null };

// Shared by handleInboundMessage and the image-message path below — find the
// lead for this channel contact (or create one), and make sure it has a
// conversation to write into.
export async function findOrCreateLeadForInbound(
  profile: PhotographerProfile,
  source: LeadSource,
  externalContactId: string
): Promise<LeadWithConversation> {
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
  return lead;
}

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

  const lead = await findOrCreateLeadForInbound(profile, source, externalContactId);
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

// A customer-sent image (e.g. proof of payment) never reaches the AI — it's
// handled deterministically, same as any other message type Mandy can't
// process herself. Stores the image reference on the message, hands the lead
// to the photographer, and returns a short static acknowledgment (not
// AI-generated) so the customer isn't left with silence.
export async function recordInboundImageMessage(opts: {
  profile: PhotographerProfile;
  lead: LeadWithConversation;
  inboundAttachmentId: string;
  externalMessageId?: string;
}): Promise<{ ackReply: string } | null> {
  const { profile, inboundAttachmentId, externalMessageId } = opts;
  let { lead } = opts;

  if (externalMessageId) {
    const already = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
    if (already) return null;
  }

  if (!lead.conversation) {
    lead = {
      ...lead,
      conversation: await prisma.conversation.create({
        data: { profileId: profile.id, kind: lead.source as LeadSource, leadId: lead.id },
      }),
    };
  }
  const conversationId = lead.conversation!.id;

  await prisma.message.create({
    data: {
      conversationId,
      role: "CUSTOMER",
      content: "[Image attached]",
      inboundAttachmentIds: JSON.stringify([inboundAttachmentId]),
      externalId: externalMessageId,
    },
  });

  // Already mid-review — record the extra image but don't repeat the ack.
  if (lead.needsHuman) return null;

  // Opt-in, high-risk exception to the "AI cannot set money states" rule —
  // see src/lib/ai/vision.ts and src/lib/leads/confirm-deposit.ts. Only
  // engages when the photographer has explicitly turned this on; the vision
  // model itself never touches the DB, it only returns a verdict that's
  // checked against a fixed threshold in plain code below.
  if (profile.autoConfirmPayments) {
    const verification = await verifyAndMaybeConfirm(profile, lead, inboundAttachmentId, conversationId);
    if (verification) return verification;
  }

  const photographer = profile.photographerName || "the team";
  const ackReply = `Thanks for sending this! I've forwarded it to ${photographer} to verify — they'll confirm shortly 😊`;

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      needsHuman: true,
      status: "Human Takeover Needed",
      takeoverReason: "Customer sent an image (likely proof of payment) — review it in this lead's conversation.",
    },
  });

  await prisma.message.create({
    data: { conversationId, role: "MANDY", content: ackReply },
  });

  return { ackReply };
}

// Best-effort: any failure (vision call errors, low confidence, mismatch)
// returns null so the caller falls through to the normal human-handoff path.
async function verifyAndMaybeConfirm(
  profile: PhotographerProfile,
  lead: Lead,
  inboundAttachmentId: string,
  conversationId: string
): Promise<{ ackReply: string } | null> {
  try {
    const attachment = await prisma.inboundAttachment.findUnique({ where: { id: inboundAttachmentId } });
    if (!attachment) return null;

    const booking = BookingBrainSchema.parse(parseJson(profile.bookingBrain, {}));
    const verification = await verifyPaymentProof({
      imageData: attachment.data,
      mimeType: attachment.mimeType,
      paymentMethods: booking.paymentMethods || "",
      paymentInstructions: booking.paymentInstructions || "",
    });
    if (!verification || !isConfidentPaymentMatch(verification)) return null;

    const updatedLead = await confirmDepositAndBook(profile, lead);
    const ackReply = `Payment verified! ✅ RM${verification.extractedAmount} confirmed — your booking is secured 🎉`;

    await prisma.message.create({
      data: {
        conversationId,
        role: "MANDY",
        content: ackReply,
        meta: toJson({ paymentVerification: verification, leadStatus: updatedLead.status }),
      },
    });

    return { ackReply };
  } catch (err) {
    console.error("[vision] auto-confirm failed (non-fatal, falling back to human review)", err);
    return null;
  }
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
