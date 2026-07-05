import type { PackageAttachment } from "@prisma/client";

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
