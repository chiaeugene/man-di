import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/verify";
import { sendWhatsAppText, sendWhatsAppAttachmentsByIds, fetchWhatsAppMediaBytes } from "@/lib/whatsapp/client";
import {
  handleInboundMessage,
  recordUnhandledInboundMessage,
  recordInboundImageMessage,
  findOrCreateLeadForInbound,
} from "@/lib/webhooks/inbound";
import { inboundMimeToType, INBOUND_ATTACHMENT_MAX_BYTES } from "@/lib/inbound-attachments";

// Meta's one-time webhook verification handshake (configured in the Meta App
// dashboard). No auth needed — it's just proving we control this URL.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

interface WhatsAppMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
}

interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string };
  messages?: WhatsAppMessage[];
}

// Real WhatsApp webhook payloads are a few KB at most. This endpoint is
// public and unauthenticated until the signature check below runs, so it's
// the one place in the app reachable by anyone on the internet — without a
// cap, `req.text()` buffers an attacker-supplied body of any size into
// memory, which crashed the whole server (OOM) rather than just this route.
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024; // 256KB

// Streams the body in with a hard byte cap instead of buffering it all via
// req.text() first — rejects oversized payloads before they're fully read,
// and doesn't trust a declared Content-Length alone (can be missing/wrong).
async function readBodyWithLimit(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_WEBHOOK_BODY_BYTES) return null;

  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Meta always expects a fast 200 — it retries deliveries aggressively on any
// non-200 or slow response, which would otherwise cause duplicate processing.
// Every step below is wrapped so one bad message never blocks that response.
export async function POST(req: Request) {
  const rawBody = await readBodyWithLimit(req);
  if (rawBody === null) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!verifyWhatsAppSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { entry?: { changes?: { value?: WhatsAppChangeValue }[] }[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue; // delivery/read status callbacks, not messages

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const profile = await prisma.photographerProfile.findFirst({ where: { whatsappPhoneId: phoneNumberId } });
      if (!profile) {
        console.error("[whatsapp webhook] no profile matches phone_number_id", phoneNumberId);
        continue;
      }

      for (const message of value.messages) {
        try {
          if (message.type === "image" && message.image?.id) {
            const media = await fetchWhatsAppMediaBytes(message.image.id, profile.whatsappAccessToken);
            const fileType = media ? inboundMimeToType(media.mimeType) : null;
            if (media && fileType && media.data.length <= INBOUND_ATTACHMENT_MAX_BYTES) {
              const attachment = await prisma.inboundAttachment.create({
                data: {
                  profileId: profile.id,
                  fileName: `whatsapp-${message.id}`,
                  fileType,
                  mimeType: media.mimeType,
                  data: media.data,
                  sizeBytes: media.data.length,
                },
              });
              const lead = await findOrCreateLeadForInbound(profile, "WHATSAPP", message.from);
              const result = await recordInboundImageMessage({
                profile,
                lead,
                inboundAttachmentId: attachment.id,
                externalMessageId: message.id,
                caption: message.image.caption,
              });
              if (result?.ackReply) await sendWhatsAppText(phoneNumberId, message.from, result.ackReply, profile.whatsappAccessToken);
              continue;
            }
            // Download or validation failed — fall through to the generic
            // unsupported-message handling below (never worse than before).
          }

          if (message.type !== "text" || !message.text?.body) {
            await recordUnhandledInboundMessage({
              profile,
              source: "WHATSAPP",
              externalContactId: message.from,
              externalMessageId: message.id,
              note: `Customer sent an unsupported message type (${message.type}) — needs a human reply.`,
            });
            continue;
          }

          const result = await handleInboundMessage({
            profile,
            source: "WHATSAPP",
            externalContactId: message.from,
            externalMessageId: message.id,
            customerMessage: message.text.body,
          });
          if (!result) continue;

          await sendWhatsAppText(phoneNumberId, message.from, result.reply, profile.whatsappAccessToken);
          if (result.attachmentIds.length) {
            await sendWhatsAppAttachmentsByIds(phoneNumberId, message.from, result.attachmentIds, profile.whatsappAccessToken);
          }
        } catch (err) {
          console.error("[whatsapp webhook] failed to process message", message.id, err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
