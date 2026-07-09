import type { Lead, PhotographerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toJson } from "@/lib/json";
import { chatComplete, extractJson, llmConfigured, type ChatMessage } from "@/lib/ai/llm";
import { buildMandySystemPrompt } from "@/lib/ai/prompts";
import { EngineOutputSchema, type EngineOutput } from "@/lib/ai/schemas";
import { AI_ALLOWED_STATUSES, type LeadStatus } from "@/lib/constants";

const HISTORY_LIMIT = 40;

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("LLM not configured");
    this.name = "LlmNotConfiguredError";
  }
}

// Full auto-reply pipeline: load tenant brains → compile prompt → call LLM →
// parse output contract → apply guarded side effects (lead facts, status, takeover).
// Used by the playground, the WhatsApp webhook, and the release-resume flow.
// customerMessage: null means "reply to the conversation as it stands" — used
// when the photographer hands a lead back to Mandy and the last message is an
// unanswered customer message already stored in history.
export async function generateMandyReply(opts: {
  profile: PhotographerProfile;
  lead: Lead;
  conversationId: string;
  customerMessage: string | null;
}): Promise<{ reply: string; output: EngineOutput; lead: Lead; attachmentIds: string[] }> {
  const { profile, lead, conversationId, customerMessage } = opts;

  if (!llmConfigured()) throw new LlmNotConfiguredError();

  // Frozen leads never auto-reply — the photographer has taken over.
  if (lead.needsHuman) {
    throw new Error("Lead is in human takeover; Mandy will not auto-reply.");
  }

  const [packages, trainingExamples, history] = await Promise.all([
    prisma.package.findMany({
      where: { profileId: profile.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      // Metadata only — the prompt/guardrail just need ids/labels, never the
      // bytes. Loading every attachment's file payload on every chat message
      // was OOM-crashing the server.
      include: { attachments: { orderBy: { sortOrder: "asc" }, omit: { data: true } } },
    }),
    prisma.trainingExample.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.message.findMany({
      where: { conversationId },
      // Customer + reply rows are written in one transaction and share a
      // timestamp — id (creation-ordered cuid) breaks the tie, otherwise the
      // history can come back with replies sorted before their questions.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: HISTORY_LIMIT,
    }),
  ]);

  const system = buildMandySystemPrompt({ profile, packages, trainingExamples, lead });

  const messages: ChatMessage[] = [];
  for (const m of history) {
    if (m.role !== "CUSTOMER" && m.role !== "MANDY" && m.role !== "PHOTOGRAPHER") continue;
    const role = m.role === "CUSTOMER" ? ("user" as const) : ("assistant" as const);
    const last = messages[messages.length - 1];
    // Consecutive same-role turns happen when customer messages pile up during
    // a human takeover — merge them so the API sees clean alternation.
    if (last && last.role === role) last.content += `\n${m.content}`;
    else messages.push({ role, content: m.content });
  }
  if (customerMessage !== null) {
    const last = messages[messages.length - 1];
    if (last && last.role === "user") last.content += `\n${customerMessage}`;
    else messages.push({ role: "user", content: customerMessage });
  }

  const raw = await chatComplete({ system, messages, maxTokens: 4000, temperature: 0.7 });

  let parsed = EngineOutputSchema.safeParse(extractJson(raw));
  if (!parsed.success) {
    // Contract violation (plain prose instead of JSON). Retry once with the
    // bad output shown back and a pointed correction — this recovers nearly
    // all cases without punishing the conversation with a takeover.
    const retryRaw = await chatComplete({
      system,
      messages: [
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "SYSTEM: Your previous response was not the required JSON object, so it could NOT be delivered to the customer. Re-send that same reply now as ONE valid JSON object exactly matching the mandatory output contract — no other text.",
        },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    });
    parsed = EngineOutputSchema.safeParse(extractJson(retryRaw));
    if (parsed.success) console.error("[engine] JSON contract violated once; retry succeeded.");
  }

  const output: EngineOutput = parsed.success
    ? parsed.data
    : // Still broken after retry → degrade gracefully: use raw text, flag low confidence.
      {
        reply: raw.trim() || "Sorry, give me a moment! 😊",
        detectedLanguage: "en",
        extracted: {},
        suggestedStatus: null,
        takeover: { needed: false, reason: null },
        confidence: 0.3,
        sendAttachmentIds: [],
      };
  if (!parsed.success) console.error("[engine] JSON contract violated twice; falling back to raw text + takeover.");

  // Guardrail: only allow attachment ids that actually belong to this
  // tenant's active packages — the model can never reference another
  // tenant's files or an id it invented.
  const validAttachmentIds = new Set(packages.flatMap((p) => p.attachments.map((a) => a.id)));
  const attachmentIds = output.sendAttachmentIds.filter((id) => validAttachmentIds.has(id));

  const updatedLead = await applyEngineEffects(lead, output);
  return { reply: output.reply, output, lead: updatedLead, attachmentIds };
}

// Server-side guardrail layer: the model only *suggests*; we decide what applies.
async function applyEngineEffects(lead: Lead, output: EngineOutput): Promise<Lead> {
  const data: Record<string, unknown> = {};
  const ex = output.extracted ?? {};

  // Fill lead facts (only overwrite blanks — the photographer's manual edits win).
  if (ex.customerName && !lead.customerName) data.customerName = ex.customerName;
  if (ex.eventDate && !lead.eventDate) data.eventDate = ex.eventDate;
  if (ex.location && !lead.location) data.location = ex.location;
  if (ex.eventType && !lead.eventType) data.eventType = ex.eventType;
  if (ex.budgetRange && !lead.budgetRange) data.budgetRange = ex.budgetRange;

  // Status: whitelist only. Money states are photographer-only.
  const suggested = output.suggestedStatus as LeadStatus | null | undefined;
  const lowConfidence = output.confidence < 0.4;
  const takeover = output.takeover?.needed || lowConfidence;

  if (takeover) {
    data.needsHuman = true;
    data.takeoverReason =
      output.takeover?.reason || (lowConfidence ? "Mandy was not confident about this reply." : null);
    data.status = "Human Takeover Needed";
  } else if (
    suggested &&
    suggested !== lead.status &&
    AI_ALLOWED_STATUSES.includes(suggested) &&
    // Never let the AI move a lead backwards out of a money-adjacent state.
    lead.status !== "Deposit Paid" &&
    lead.status !== "Booked"
  ) {
    data.status = suggested;
  }

  if (Object.keys(data).length === 0) return lead;
  return prisma.lead.update({ where: { id: lead.id }, data });
}

// Persist one customer→Mandy exchange onto a conversation. customerMessage
// null = the inbound message was already stored (e.g. it arrived during a
// human takeover) — record only Mandy's reply.
export async function recordExchange(opts: {
  conversationId: string;
  customerMessage: string | null;
  output: EngineOutput;
  attachmentIds?: string[];
  externalMessageId?: string; // e.g. WhatsApp wamid, for redelivery dedupe
}) {
  await prisma.$transaction([
    ...(opts.customerMessage !== null
      ? [
          prisma.message.create({
            data: {
              conversationId: opts.conversationId,
              role: "CUSTOMER",
              content: opts.customerMessage,
              externalId: opts.externalMessageId,
            },
          }),
        ]
      : []),
    prisma.message.create({
      data: {
        conversationId: opts.conversationId,
        role: "MANDY",
        content: opts.output.reply,
        meta: toJson({
          detectedLanguage: opts.output.detectedLanguage,
          extracted: opts.output.extracted,
          suggestedStatus: opts.output.suggestedStatus,
          takeover: opts.output.takeover,
          confidence: opts.output.confidence,
        }),
        attachmentIds:
          opts.attachmentIds && opts.attachmentIds.length ? toJson(opts.attachmentIds) : null,
      },
    }),
    prisma.conversation.update({
      where: { id: opts.conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

// Optional: refresh lead.summary/nextAction after a few exchanges.
export async function refreshLeadSummary(profile: PhotographerProfile, lead: Lead, conversationId: string) {
  if (!llmConfigured()) return;
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: HISTORY_LIMIT,
  });
  if (history.length < 4) return;

  const transcript = history
    .map((m) => `${m.role === "CUSTOMER" ? "Customer" : "Mandy"}: ${m.content}`)
    .join("\n");

  try {
    const raw = await chatComplete({
      system:
        'You summarize sales conversations for a photography CRM. Respond ONLY with JSON: {"summary": "2-3 sentence factual summary", "nextAction": "one concrete recommended next step for the photographer"}',
      messages: [{ role: "user", content: transcript.slice(-6000) }],
      maxTokens: 600,
      temperature: 0.2,
    });
    const json = extractJson(raw) as { summary?: string; nextAction?: string } | null;
    if (json?.summary) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { summary: json.summary, nextAction: json.nextAction ?? null },
      });
    }
  } catch {
    // Summary refresh is best-effort; never block the reply on it.
  }
}
