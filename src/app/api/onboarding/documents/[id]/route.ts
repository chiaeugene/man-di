import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;

    const doc = await prisma.onboardingDocument.findFirst({ where: { id, profileId: profile.id } });
    if (!doc) throw new ApiError(404, "Document not found.");

    await prisma.onboardingDocument.delete({ where: { id } });
    return { ok: true };
  });
}
