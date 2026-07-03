import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";

// Start a new playground session: a sandbox lead + conversation, so testing
// exercises the exact same pipeline (status automation, takeover, CRM) as
// real WhatsApp leads will in Phase 2.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();

    const lead = await prisma.lead.create({
      data: {
        profileId: profile.id,
        source: "PLAYGROUND",
        customerName: null,
        conversation: { create: { profileId: profile.id, kind: "PLAYGROUND" } },
      },
      include: { conversation: true },
    });

    return { leadId: lead.id, conversationId: lead.conversation!.id };
  });
}
