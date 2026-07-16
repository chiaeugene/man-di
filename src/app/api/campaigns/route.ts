import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { toJson } from "@/lib/json";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/constants";
import { resolveAudience, type CampaignAudience } from "@/lib/campaigns";

export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const campaigns = await prisma.campaign.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
    });
    return { campaigns };
  });
}

const AudienceSchema = z.object({
  statuses: z.array(z.enum(LEAD_STATUSES)).optional(),
  sources: z.array(z.enum(LEAD_SOURCES)).optional(),
});

const PostSchema = z.object({
  name: z.string().min(1).max(120),
  message: z.string().min(1).max(1000),
  audience: AudienceSchema.default({}),
});

export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = PostSchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid campaign data.");

    const audience: CampaignAudience = body.data.audience;
    const previewRecipients = await resolveAudience(profile, audience);

    const campaign = await prisma.campaign.create({
      data: {
        profileId: profile.id,
        name: body.data.name,
        message: body.data.message,
        audience: toJson(audience),
        recipientCount: previewRecipients.length,
      },
    });

    return { campaign };
  });
}
