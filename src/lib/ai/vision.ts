import Anthropic from "@anthropic-ai/sdk";
import { extractJson } from "@/lib/ai/llm";

export type PaymentVerification = {
  looksLikePaymentProof: boolean;
  extractedAmount: number | null; // MYR
  extractedRecipient: string | null;
  recipientMatchesStudio: boolean;
  confidence: number; // 0-1
  reasoning: string;
};

const VERIFICATION_THRESHOLD = 0.85;

export function isConfidentPaymentMatch(v: PaymentVerification): boolean {
  return (
    v.looksLikePaymentProof &&
    v.recipientMatchesStudio &&
    v.extractedAmount != null &&
    v.confidence >= VERIFICATION_THRESHOLD
  );
}

const SYSTEM_PROMPT = `You verify payment-proof screenshots for a photography studio's booking system. You are called by software, not a person — respond with EXACTLY one JSON object, nothing else: {"looksLikePaymentProof": boolean, "extractedAmount": number|null, "extractedRecipient": string|null, "recipientMatchesStudio": boolean, "confidence": number between 0 and 1, "reasoning": "short explanation"}.
"extractedAmount" is the MYR amount visible in the image (numeric, no currency symbol), or null if unreadable.
"extractedRecipient" is the recipient name/bank account/e-wallet id visible in the image, or null if unreadable.
"recipientMatchesStudio" must be true when the recipient visible in the image clearly matches the studio's own configured payment details given below. IMPORTANT: Malaysian banking apps routinely mask account numbers in exported receipts/screenshots, typically showing only the last 3-4 digits (e.g. "****7698" or "*******2193"). This is completely normal, not suspicious — if the visible masked digits match the corresponding digits of the studio's configured account number, AND the recipient name matches (allowing for minor spelling/spacing differences), treat this as a confident match. Only mark false for an actual mismatch (different name, different visible digits) or genuine uncertainty (image too blurry/cropped to read at all) — do not lower confidence purely because the account number happens to be masked.
Be conservative about actual fraud signals (edited-looking images, wrong recipient, implausible amounts) — but do not be needlessly conservative about normal bank-app UI behavior like masking, watermarks, or export/share screens around the receipt.`;

async function callVisionOnce(opts: {
  client: Anthropic;
  model: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64Data: string;
  paymentMethods: string;
  paymentInstructions: string;
}): Promise<PaymentVerification | null> {
  const res = await opts.client.messages.create({
    model: opts.model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: opts.mediaType, data: opts.base64Data } },
          {
            type: "text",
            text: `The studio's configured payment methods:\n${opts.paymentMethods || "(not configured)"}\n\nThe studio's configured payment instructions (may include the exact recipient name/account):\n${opts.paymentInstructions || "(not configured)"}\n\nDoes this screenshot show a genuine payment to this studio? Respond with the JSON object only.`,
          },
        ],
      },
    ],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;

  const parsed = extractJson(block.text) as Partial<PaymentVerification> | null;
  if (!parsed || typeof parsed.confidence !== "number") return null;

  return {
    looksLikePaymentProof: Boolean(parsed.looksLikePaymentProof),
    extractedAmount: typeof parsed.extractedAmount === "number" ? parsed.extractedAmount : null,
    extractedRecipient: typeof parsed.extractedRecipient === "string" ? parsed.extractedRecipient : null,
    recipientMatchesStudio: Boolean(parsed.recipientMatchesStudio),
    confidence: parsed.confidence,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };
}

// Deliberately isolated from chatComplete() in llm.ts — that function's
// ChatMessage.content is hard-typed to string, and this is a fundamentally
// different structured task (image-in, JSON-verdict-out). This never
// mutates any money state itself; it only returns a structured verdict that
// the caller checks against a fixed threshold in plain code.
//
// Anthropic-only for now (this project's default provider). Best-effort:
// never throws — any failure (no API key, API error, unparseable response)
// returns null so the caller always has a clean "couldn't verify" fallback.
//
// Vision judgment on a single call is not perfectly deterministic — the
// exact same image can score above or below the confidence threshold on
// different calls (confirmed against real customer screenshots: one image,
// sent 7 times, auto-confirmed only once). Rather than trusting a single
// roll, take up to 2 independent readings and use the first confident one —
// this doesn't loosen what counts as a match, it just gives a fair image a
// second chance instead of failing it on a single unlucky call.
export async function verifyPaymentProof(opts: {
  imageData: Uint8Array;
  mimeType: string;
  paymentMethods: string;
  paymentInstructions: string;
}): Promise<PaymentVerification | null> {
  const provider = process.env.LLM_PROVIDER || "anthropic";
  if (provider !== "anthropic" || !process.env.ANTHROPIC_API_KEY) return null;

  const mediaType = opts.mimeType as "image/jpeg" | "image/png" | "image/webp";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.MANDY_LLM_MODEL || "claude-sonnet-5";
  const base64Data = Buffer.from(opts.imageData).toString("base64");
  const callOpts = { client, model, mediaType, base64Data, paymentMethods: opts.paymentMethods, paymentInstructions: opts.paymentInstructions };

  let lastResult: PaymentVerification | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await callVisionOnce(callOpts);
      if (result) {
        lastResult = result;
        if (isConfidentPaymentMatch(result)) return result;
      }
    } catch (err) {
      console.error(`[vision] verifyPaymentProof attempt ${attempt + 1} failed (non-fatal)`, err);
    }
  }
  // Neither attempt was confident — return the last real reading (if any) so
  // the caller can still store it for audit, even though it won't auto-confirm.
  return lastResult;
}
