import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id, attachmentId } = await params;

    const attachment = await prisma.packageAttachment.findFirst({
      where: { id: attachmentId, packageId: id, profileId: profile.id },
    });
    if (!attachment) throw new ApiError(404, "Attachment not found.");

    await prisma.packageAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
  });
}
