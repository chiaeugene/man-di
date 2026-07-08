import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Provider-agnostic chat completion. Default: Anthropic Claude.
// Switch with LLM_PROVIDER=openai. Model override: MANDY_LLM_MODEL.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function llmConfigured(): boolean {
  const provider = process.env.LLM_PROVIDER || "anthropic";
  return provider === "openai"
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function chatComplete(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const provider = process.env.LLM_PROVIDER || "anthropic";
  const maxTokens = opts.maxTokens ?? 1024;
  const temperature = opts.temperature ?? 0.7;

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.MANDY_LLM_MODEL || "gpt-4o";
    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    });
    return res.choices[0]?.message?.content ?? "";
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.MANDY_LLM_MODEL || "claude-sonnet-5";
  // Newer Claude models reject the deprecated `temperature` param.
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: opts.system,
    messages: opts.messages,
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block) {
    console.error(
      "[llm debug] no text block — stop_reason:", res.stop_reason,
      "content types:", res.content.map((b) => b.type),
      "usage:", JSON.stringify(res.usage)
    );
  }
  return block && block.type === "text" ? block.text : "";
}

// Extracts the first JSON object from a model response (handles ```json fences
// and leading/trailing prose).
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  // Walk to the matching closing brace.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
