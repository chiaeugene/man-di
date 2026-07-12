import type { InboundAttachment } from "@prisma/client";
import { ATTACHMENT_MIME_TO_TYPE } from "@/lib/attachments";

// A bit more conservative than the 8MB outbound cap — this is customer-
// supplied content arriving over a public-facing channel, not curated by
// the photographer.
export const INBOUND_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5MB

// Images only for now — no inbound PDFs/documents.
export function inboundMimeToType(mimeType: string): "PHOTO" | null {
  return ATTACHMENT_MIME_TO_TYPE[mimeType] === "PHOTO" ? "PHOTO" : null;
}

// Same discipline as PackageAttachment/AttachmentMetadata: never load the
// heavy `data` bytes column except in the one route that serves them.
export type InboundAttachmentMetadata = Omit<InboundAttachment, "data">;

export function serializeInboundAttachment(a: InboundAttachmentMetadata) {
  return {
    id: a.id,
    fileName: a.fileName,
    fileType: a.fileType,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    url: `/api/inbound-attachments/${a.id}`,
  };
}
export type SerializedInboundAttachment = ReturnType<typeof serializeInboundAttachment>;
