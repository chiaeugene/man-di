import type { PackageAttachment } from "@prisma/client";

export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024; // 8MB

export const ATTACHMENT_MIME_TO_TYPE: Record<string, "PHOTO" | "PDF"> = {
  "image/jpeg": "PHOTO",
  "image/png": "PHOTO",
  "image/webp": "PHOTO",
  "application/pdf": "PDF",
};

// Metadata only — never includes the raw file bytes.
export function serializeAttachment(a: PackageAttachment) {
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
