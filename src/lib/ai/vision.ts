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

// Deliberately isolated from chatComplete() in llm.ts — that function's
// ChatMessage.content is hard-typed to string, and this is a fundamentally
// different structured task (image-in, JSON-verdict-out). This never
// mutates any money state itself; it only returns a structured verdict that
// the caller checks against a fixed threshold in plain code.
//
// Anthropic-only for now (this project's default provider). Best-effort:
// never throws — any failure (no API key, API error, unparseable response)
// returns null so the caller always has a clean "couldn't verify" fallback.
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

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = process.env.MANDY_LLM_MODEL || "claude-sonnet-5";
    const base64Data = Buffer.from(opts.imageData).toString("base64");

    const res = await client.messages.create({
      model,
      max_tokens: 1024,
      system:
        'You verify payment-proof screenshots for a photography studio\'s booking system. You are called by software, not a person — respond with EXACTLY one JSON object, nothing else: {"looksLikePaymentProof": boolean, "extractedAmount": number|null, "extractedRecipient": string|null, "recipientMatchesStudio": boolean, "confidence": number between 0 and 1, "reasoning": "short explanation"}. "extractedAmount" is the MYR amount visible in the image (numeric, no currency symbol), or null if unreadable. "extractedRecipient" is the recipient name/bank account/e-wallet id visible in the image, or null if unreadable. "recipientMatchesStudio" must be true ONLY if the recipient visible in the image clearly matches the studio\'s own configured payment details given below — a mismatch, or any uncertainty, must be false. Be conservative: this decides whether a booking gets auto-confirmed without human review, so when in doubt, lower your confidence rather than guessing favorably.',
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
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
  } catch (err) {
    console.error("[vision] verifyPaymentProof failed (non-fatal)", err);
    return null;
  }
}
