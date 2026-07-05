import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/verify";
import { sendWhatsAppText, sendWhatsAppAttachment } from "@/lib/whatsapp/client";
import { handleInboundMessage, recordUnhandledInboundMessage } from "@/lib/webhooks/inbound";

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
}

interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string };
  messages?: WhatsAppMessage[];
}

// Meta always expects a fast 200 — it retries deliveries aggressively on any
// non-200 or slow response, which would otherwise cause duplicate processing.
// Every step below is wrapped so one bad message never blocks that response.
export async function POST(req: Request) {
  const rawBody = await req.text();

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

          await sendWhatsAppText(phoneNumberId, message.from, result.reply);
          if (result.attachmentIds.length) {
            const attachments = await prisma.packageAttachment.findMany({
              where: { id: { in: result.attachmentIds } },
            });
            for (const attachment of attachments) {
              await sendWhatsAppAttachment(phoneNumberId, message.from, attachment);
            }
          }
        } catch (err) {
          console.error("[whatsapp webhook] failed to process message", message.id, err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
