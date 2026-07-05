import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TO_TYPE, serializeAttachment } from "@/lib/attachments";

type Params = { params: Promise<{ id: string }> };

// Upload a photo/PDF attachment onto a package. Mandy can later choose to
// send it during a conversation (see src/lib/ai/engine.ts).
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const profile = await requireProfile();
    const { id } = await params;

    const pkg = await prisma.package.findFirst({ where: { id, profileId: profile.id } });
    if (!pkg) throw new ApiError(404, "Package not found.");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided.");

    const fileType = ATTACHMENT_MIME_TO_TYPE[file.type];
    if (!fileType) throw new ApiError(400, "Only JPEG, PNG, WEBP images or PDF files are allowed.");
    if (file.size > ATTACHMENT_MAX_BYTES) throw new ApiError(400, "File is too large (max 8MB).");

    const label = form.get("label");
    const buffer = Buffer.from(await file.arrayBuffer());

    const count = await prisma.packageAttachment.count({ where: { packageId: id } });

    const attachment = await prisma.packageAttachment.create({
      data: {
        profileId: profile.id,
        packageId: id,
        fileName: file.name || "attachment",
        label: typeof label === "string" && label.trim() ? label.trim().slice(0, 200) : null,
        fileType,
        mimeType: file.type,
        data: buffer,
        sizeBytes: file.size,
        sortOrder: count,
      },
    });

    return { attachment: serializeAttachment(attachment) };
  });
}
