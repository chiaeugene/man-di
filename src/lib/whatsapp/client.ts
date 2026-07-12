import type { PackageAttachment } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Defensive ceiling on how many files Mandy can send in one reply. She's
// prompted to attach sparingly (usually zero or one), but this guarantees a
// single message can never try to push an unbounded number of large PDFs.
const MAX_ATTACHMENTS_PER_MESSAGE = 4;

// Outbound Graph API calls. Failures are logged and swallowed, never thrown —
// a failed send must never break the webhook's required fast 200 response
// back to Meta (Meta retries deliveries aggressively on non-200/slow
// responses, which would otherwise cause duplicate processing).

function apiBase(phoneNumberId: string): string {
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  return `https://graph.facebook.com/${version}/${phoneNumberId}`;
}

function accessToken(): string | null {
  return process.env.WHATSAPP_ACCESS_TOKEN || null;
}

export function whatsappConfigured(): boolean {
  return Boolean(accessToken());
}

export async function sendWhatsAppText(phoneNumberId: string, to: string, text: string): Promise<void> {
  const token = accessToken();
  if (!token) {
    console.error("[whatsapp] WHATSAPP_ACCESS_TOKEN not configured — cannot send message.");
    return;
  }
  try {
    const res = await fetch(`${apiBase(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp] sendWhatsAppText failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[whatsapp] sendWhatsAppText error", err);
  }
}

// Uploads a package attachment's bytes to Meta's Media API, then sends it as
// an image or document message referencing the returned media id.
export async function sendWhatsAppAttachment(
  phoneNumberId: string,
  to: string,
  attachment: PackageAttachment
): Promise<void> {
  const token = accessToken();
  if (!token) {
    console.error("[whatsapp] WHATSAPP_ACCESS_TOKEN not configured — cannot send attachment.");
    return;
  }
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([new Uint8Array(attachment.data)], { type: attachment.mimeType }), attachment.fileName);

    const uploadRes = await fetch(`${apiBase(phoneNumberId)}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!uploadRes.ok) {
      console.error("[whatsapp] media upload failed", uploadRes.status, await uploadRes.text());
      return;
    }
    const { id: mediaId } = (await uploadRes.json()) as { id: string };

    const isImage = attachment.fileType === "PHOTO";
    const sendRes = await fetch(`${apiBase(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: isImage ? "image" : "document",
        [isImage ? "image" : "document"]: isImage
          ? { id: mediaId }
          : { id: mediaId, filename: attachment.fileName },
      }),
    });
    if (!sendRes.ok) {
      console.error("[whatsapp] sendWhatsAppAttachment failed", sendRes.status, await sendRes.text());
    }
  } catch (err) {
    console.error("[whatsapp] sendWhatsAppAttachment error", err);
  }
}

// Sends a set of package attachments by id, loading each file's bytes ONE AT
// A TIME (not all at once) so peak memory is a single file — sending several
// large PDFs in one batch would otherwise reintroduce the load-everything-
// into-memory pattern that OOM-crashed the server.
export async function sendWhatsAppAttachmentsByIds(
  phoneNumberId: string,
  to: string,
  attachmentIds: string[]
): Promise<void> {
  for (const id of attachmentIds.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
    const attachment = await prisma.packageAttachment.findUnique({ where: { id } });
    if (attachment) await sendWhatsAppAttachment(phoneNumberId, to, attachment);
  }
}

// Downloads a customer-sent media item (e.g. a payment-proof photo). Meta's
// media API is a two-step fetch: the webhook only gives you a media id, which
// resolves to a short-lived download url + mime type, which you then fetch
// with the same bearer token. Best-effort — never throws, matching the rest
// of this file's discipline (a failed download must never break the
// webhook's required fast response back to Meta).
export async function fetchWhatsAppMediaBytes(
  mediaId: string
): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string } | null> {
  const token = accessToken();
  if (!token) {
    console.error("[whatsapp] WHATSAPP_ACCESS_TOKEN not configured — cannot fetch media.");
    return null;
  }
  try {
    const version = process.env.WHATSAPP_API_VERSION || "v21.0";
    const metaRes = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.error("[whatsapp] media metadata fetch failed", metaRes.status, await metaRes.text());
      return null;
    }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url || !meta.mime_type) return null;

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileRes.ok) {
      console.error("[whatsapp] media download failed", fileRes.status);
      return null;
    }
    // fetch's arrayBuffer() is typed as ArrayBufferLike (covers the
    // never-actually-possible SharedArrayBuffer case) — Prisma's Bytes
    // column type wants the narrower ArrayBuffer-backed Uint8Array, which
    // this always genuinely is at runtime.
    const data = new Uint8Array(await fileRes.arrayBuffer()) as Uint8Array<ArrayBuffer>;
    return { data, mimeType: meta.mime_type };
  } catch (err) {
    console.error("[whatsapp] fetchWhatsAppMediaBytes error (non-fatal)", err);
    return null;
  }
}
