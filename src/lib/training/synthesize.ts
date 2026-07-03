import type { PhotographerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseJson, toJson } from "@/lib/json";
import { chatComplete, llmConfigured } from "@/lib/ai/llm";

// After the role-plays, distil the photographer's replies into a sales-style
// profile stored on the Sales Brain. Best-effort: skipped without an LLM key
// (the raw examples are still used as few-shots either way).
export async function synthesizeStyleProfile(profile: PhotographerProfile): Promise<string | null> {
  if (!llmConfigured()) return null;

  const examples = await prisma.trainingExample.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "asc" },
  });
  if (examples.length === 0) return null;

  const transcript = examples
    .map((e) => `Customer: ${e.customerMessage}\nPhotographer: ${e.photographerReply}`)
    .join("\n\n");

  const raw = await chatComplete({
    system: `You analyze how a wedding photographer sells over WhatsApp. From the mock conversations, write a compact style profile (max 180 words, plain text, no headings) covering: overall tone; how they explain value; how they introduce packages; how they handle price objections; how strongly they push toward deposit (soft/balanced/assertive); and their positioning archetype (premium / friendly / emotional / direct / luxury / casual / consultative). Write it as direct instructions to an AI assistant imitating them, e.g. "Speak warmly with light emoji use. When price objections come up, ..."`,
    messages: [{ role: "user", content: transcript.slice(0, 12000) }],
    maxTokens: 400,
    temperature: 0.3,
  });

  const styleProfile = raw.trim();
  if (!styleProfile) return null;

  const salesBrain = parseJson<Record<string, unknown>>(profile.salesBrain, {});
  salesBrain.styleProfile = styleProfile;
  await prisma.photographerProfile.update({
    where: { id: profile.id },
    data: { salesBrain: toJson(salesBrain) },
  });
  return styleProfile;
}
