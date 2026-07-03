import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const BodySchema = z.object({ action: z.enum(["take", "release"]) });

// take: photographer handles the lead manually (Mandy stops replying).
// release: hand the conversation back to Mandy.
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
    return { lead: updated };
  });
}
