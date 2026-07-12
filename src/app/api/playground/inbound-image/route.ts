import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { INBOUND_ATTACHMENT_MAX_BYTES, inboundMimeToType, serializeInboundAttachment } from "@/lib/inbound-attachments";

// Lets a Playground tester simulate a customer sending an image (e.g. proof
// of payment) — same validation as the outbound package-attachment upload,
// but stored as an InboundAttachment scoped to a playground conversation.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();

    const form = await req.formData();
    const conversationId = form.get("conversationId");
    if (typeof conversationId !== "string") throw new ApiError(400, "conversationId is required.");

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, profileId: profile.id, kind: "PLAYGROUND" },
    });
    if (!conversation) throw new ApiError(404, "Playground session not found.");

    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided.");

    const fileType = inboundMimeToType(file.type);
    if (!fileType) throw new ApiError(400, "Only JPEG, PNG, or WEBP images are allowed.");
    if (file.size > INBOUND_ATTACHMENT_MAX_BYTES) throw new ApiError(400, "File is too large (max 5MB).");

    const buffer = Buffer.from(await file.arrayBuffer());

    const attachment = await prisma.inboundAttachment.create({
      data: {
        profileId: profile.id,
        fileName: file.name || "photo",
        fileType,
        mimeType: file.type,
        data: buffer,
        sizeBytes: file.size,
      },
    });

    return { attachment: serializeInboundAttachment(attachment) };
  });
}
