import crypto from "node:crypto";

// Verifies Meta's X-Hub-Signature-256 header against the raw request body.
// Must run on the *raw* body (before any JSON.parse) — the signature is
// computed over the exact bytes Meta sent. Rejects forged/tampered webhook
// deliveries; this is the only thing standing between the public internet
// and "pretend to be a customer messaging this tenant".
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null | undefined): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expectedHex = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(provided, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}
