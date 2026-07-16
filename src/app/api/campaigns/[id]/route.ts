import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;
    const campaign = await prisma.campaign.findFirst({ where: { id, profileId: profile.id } });
    if (!campaign) throw new ApiError(404, "Campaign not found.");
    return { campaign };
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;
    const campaign = await prisma.campaign.findFirst({ where: { id, profileId: profile.id } });
    if (!campaign) throw new ApiError(404, "Campaign not found.");
    if (campaign.status !== "DRAFT") throw new ApiError(400, "Only draft campaigns can be deleted.");

    await prisma.campaign.delete({ where: { id: campaign.id } });
    return { ok: true };
  });
}
