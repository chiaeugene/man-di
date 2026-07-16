import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { sendCampaign } from "@/lib/campaigns";

type Params = { params: Promise<{ id: string }> };

// Real send, triggered explicitly by the photographer from the Campaigns
// page — not automated, not reachable from the cron path.
export async function POST(_req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;

    const campaign = await prisma.campaign.findFirst({ where: { id, profileId: profile.id } });
    if (!campaign) throw new ApiError(404, "Campaign not found.");
    if (campaign.status !== "DRAFT") throw new ApiError(400, "Campaign has already been sent.");

    const result = await sendCampaign(profile, campaign);
    const updated = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    return { campaign: updated, result };
  });
}
