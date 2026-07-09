import type { PackageAttachment } from "@prisma/client";

export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8MB

export const ATTACHMENT_MIME_TO_TYPE: Record<string, "PHOTO" | "PDF"> = {
  "image/jpeg": "PHOTO",
  "image/png": "PHOTO",
  "image/webp": "PHOTO",
  "application/pdf": "PDF",
};

// Attachment metadata without the heavy `data` bytes column. Loading the raw
// bytes for every attachment (e.g. listing packages, or on every chat message)
// pulls the whole file payload into memory and OOM-crashes the server — so
// list/chat queries deliberately omit `data`, and only the serve/send paths
// ever load the actual bytes, one file at a time.
export type AttachmentMetadata = Omit<PackageAttachment, "data">;

// Metadata only — never includes the raw file bytes.
export function serializeAttachment(a: AttachmentMetadata) {
  return {
    id: a.id,
    packageId: a.packageId,
    fileName: a.fileName,
    label: a.label,
    fileType: a.fileType,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    sortOrder: a.sortOrder,
    url: `/api/attachments/${a.id}`,
  };
}
export type SerializedAttachment = ReturnType<typeof serializeAttachment>;
