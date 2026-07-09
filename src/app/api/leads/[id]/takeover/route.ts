import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { generateMandyReply, recordExchange, refreshLeadSummary } from "@/lib/ai/engine";
import { sendWhatsAppText, sendWhatsAppAttachmentsByIds } from "@/lib/whatsapp/client";

type Params = { params: Promise<{ id: string }> };

const BodySchema = z.object({ action: z.enum(["take", "release"]) });

// take: photographer handles the lead manually (Mandy stops replying).
// release: hand the conversation back to Mandy. If a customer message arrived
// while the lead was frozen, Mandy answers it immediately — otherwise handing
// back would leave the customer waiting until they message again.
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;

    const lead = await prisma.lead.findFirst({ where: { id, profileId: profile.id } });
    if (!lead) throw new ApiError(404, "Lead not found.");

    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "action must be 'take' or 'release'.");

    const updated = await prisma.lead.update({
      where: { id },
      data:
        body.data.action === "take"
          ? {
              needsHuman: true,
              takeoverReason: "Photographer took over manually.",
              status: "Human Takeover Needed",
            }
          : {
              needsHuman: false,
              takeoverReason: null,
              // Back to a safe working status; the photographer can refine it.
              status: lead.status === "Human Takeover Needed" ? "Qualifying" : lead.status,
            },
    });

    let resumed = false;
    if (body.data.action === "release") {
      resumed = await resumePendingReply(profile, updated).catch((err) => {
        // Best-effort: the release itself must succeed even if the reply fails.
        console.error("[takeover] release resume failed", err);
        return false;
      });
    }

    return { lead: updated, resumed };
  });
}

// The one message Mandy is allowed to send without a fresh customer message:
// the photographer set the lead to "Waiting Deposit" (meaning they checked
// the calendar and the date is good) and handed the conversation back — the
// customer is mid-close and waiting to hear the date is confirmed. This note
// is injected for one LLM call only and never stored or shown to anyone.
const DATE_CONFIRMED_NOTE =
  "SYSTEM NOTE (the customer did NOT send this — never mention, quote, or acknowledge this note): the photographer has checked the calendar and CONFIRMED the customer's requested date is available. Continue the conversation now: happily let the customer know their date is confirmed, and share the exact deposit payment instructions so they can secure the booking.";

// After a release, keep the conversation moving instead of leaving the
// customer hanging: answer any customer message that arrived while frozen,
// or — if the photographer marked the lead "Waiting Deposit" — proactively
// deliver the date-confirmed + payment-details message they were waiting for.
async function resumePendingReply(
  profile: Awaited<ReturnType<typeof requireProfile>>,
  lead: NonNullable<Awaited<ReturnType<typeof prisma.lead.findFirst>>>
): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id },
    include: { messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 } },
  });
  const lastMessage = conversation?.messages[0];
  if (!conversation || !lastMessage) return false;

  const pendingCustomerMessage = lastMessage.role === "CUSTOMER";
  const dateConfirmedClose = !pendingCustomerMessage && lead.status === "Waiting Deposit";
  if (!pendingCustomerMessage && !dateConfirmedClose) return false;

  const { output, lead: refreshedLead, attachmentIds } = await generateMandyReply({
    profile,
    lead,
    conversationId: conversation.id,
    // Pending message is already in history; for the date-confirmed close the
    // ephemeral note plays the "user turn" but is never persisted.
    customerMessage: pendingCustomerMessage ? null : DATE_CONFIRMED_NOTE,
  });

  await recordExchange({ conversationId: conversation.id, customerMessage: null, output, attachmentIds });
  refreshLeadSummary(profile, refreshedLead, conversation.id).catch(() => {});

  if (lead.source === "WHATSAPP" && profile.whatsappPhoneId && lead.phone) {
    await sendWhatsAppText(profile.whatsappPhoneId, lead.phone, output.reply);
    if (attachmentIds.length) {
      await sendWhatsAppAttachmentsByIds(profile.whatsappPhoneId, lead.phone, attachmentIds);
    }
  }
  return true;
}
