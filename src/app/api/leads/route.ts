import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";
import { LEAD_STATUSES } from "@/lib/constants";

export async function GET(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");

    const leads = await prisma.lead.findMany({
      where: {
        profileId: profile.id,
        ...(status && (LEAD_STATUSES as readonly string[]).includes(status) ? { status } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return { leads };
  });
}
