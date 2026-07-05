import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { generateMandyReply, recordExchange, refreshLeadSummary } from "@/lib/ai/engine";
import { serializeAttachment } from "@/lib/attachments";

const BodySchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1).max(4000),
});

// Photographer plays the customer; Mandy replies via the full production pipeline.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "conversationId and message are required.");

    const conversation = await prisma.conversation.findFirst({
      where: { id: body.data.conversationId, profileId: profile.id, kind: "PLAYGROUND" },
      include: { lead: true },
    });
    if (!conversation?.lead) throw new ApiError(404, "Playground session not found.");

    if (conversation.lead.needsHuman) {
      throw new ApiError(
        409,
        "This test lead is in human takeover — Mandy has stopped auto-replying (exactly what would happen on WhatsApp). Start a new session or release the lead from the Leads page."
      );
    }

    const { output, lead, attachmentIds } = await generateMandyReply({
      profile,
      lead: conversation.lead,
      conversationId: conversation.id,
      customerMessage: body.data.message,
    });

    await recordExchange({
      conversationId: conversation.id,
      customerMessage: body.data.message,
      output,
      attachmentIds,
    });

    // Fire-and-forget summary refresh (best-effort).
    refreshLeadSummary(profile, lead, conversation.id).catch(() => {});

    const attachments = attachmentIds.length
      ? (await prisma.packageAttachment.findMany({ where: { id: { in: attachmentIds } } })).map(
          serializeAttachment
        )
      : [];

    return {
      reply: output.reply,
      detectedLanguage: output.detectedLanguage,
      extracted: output.extracted,
      status: lead.status,
      takeover: lead.needsHuman
        ? { needed: true, reason: lead.takeoverReason }
        : { needed: false, reason: null },
      leadId: lead.id,
      attachments,
    };
  });
}
