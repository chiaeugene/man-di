import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { generateMandyReply, recordExchange, refreshLeadSummary } from "@/lib/ai/engine";
import { sendWhatsAppText, sendWhatsAppAttachment } from "@/lib/whatsapp/client";

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

// If the conversation's last message is an unanswered customer message
// (arrived during takeover), have Mandy answer it now — and deliver the
// answer on the lead's channel if it's a connected one.
async function resumePendingReply(
  profile: Awaited<ReturnType<typeof requireProfile>>,
  lead: NonNullable<Awaited<ReturnType<typeof prisma.lead.findFirst>>>
): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const lastMessage = conversation?.messages[0];
  if (!conversation || !lastMessage || lastMessage.role !== "CUSTOMER") return false;

  const { output, lead: refreshedLead, attachmentIds } = await generateMandyReply({
    profile,
    lead,
    conversationId: conversation.id,
    customerMessage: null, // the pending message is already in history
  });

  await recordExchange({ conversationId: conversation.id, customerMessage: null, output, attachmentIds });
  refreshLeadSummary(profile, refreshedLead, conversation.id).catch(() => {});

  if (lead.source === "WHATSAPP" && profile.whatsappPhoneId && lead.phone) {
    await sendWhatsAppText(profile.whatsappPhoneId, lead.phone, output.reply);
    if (attachmentIds.length) {
      const attachments = await prisma.packageAttachment.findMany({ where: { id: { in: attachmentIds } } });
      for (const attachment of attachments) {
        await sendWhatsAppAttachment(profile.whatsappPhoneId, lead.phone, attachment);
      }
    }
  }
  return true;
}
