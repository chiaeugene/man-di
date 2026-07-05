import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { parseJson, toJson } from "@/lib/json";
import { getOnboardingSteps, getSectionLabels, getCannedAcks } from "@/lib/onboarding/steps";
import { compileBrains } from "@/lib/onboarding/compile";
import { chatComplete, llmConfigured } from "@/lib/ai/llm";
import { getServerLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";

const BodySchema = z
  .object({ message: z.string().max(4000).optional(), skip: z.boolean().optional() })
  .refine((d) => d.skip || (d.message && d.message.trim().length > 0), {
    message: "Message is required.",
  });

const SKIP_ACK: Record<Locale, string> = {
  en: "No problem, skipping that — we can always add it later in Settings. 👍",
  zh: "没问题，先跳过 — 之后随时可以在「设置」里补充。👍",
  ms: "Tiada masalah, langkau dahulu — kita boleh tambah kemudian dalam Tetapan. 👍",
};

// Photographer answers the current question → store, advance, return Mandy's
// acknowledgement + next question. On the last answer, compile the brains.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const locale = await getServerLocale();
    const steps = getOnboardingSteps(locale);
    const sectionLabels = getSectionLabels(locale);

    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Message is required.");

    const step = profile.onboardingStep;
    if (step >= steps.length) throw new ApiError(400, "Onboarding interview is already complete.");

    const current = steps[step];
    const answers = parseJson<Record<string, string>>(profile.onboardingAnswers, {});
    const skipped = Boolean(body.data.skip);
    answers[current.id] = skipped ? "" : body.data.message!.trim();

    const nextStep = step + 1;
    const done = nextStep >= steps.length;

    const updated = await prisma.photographerProfile.update({
      where: { id: profile.id },
      data: {
        onboardingAnswers: toJson(answers),
        onboardingStep: nextStep,
        onboardingStatus: done ? "TRAINING" : "INTERVIEW",
      },
    });

    if (done) await compileBrains(updated);

    const next = done ? null : steps[nextStep];
    const ack = skipped
      ? SKIP_ACK[locale] ?? SKIP_ACK.en
      : await buildAck(current.question, body.data.message!, done, locale);

    return {
      ack,
      nextQuestion: next
        ? { id: next.id, section: sectionLabels[next.section], question: next.question }
        : null,
      step: nextStep,
      totalSteps: steps.length,
      done,
    };
  });
}

const DONE_FALLBACK: Record<Locale, string> = {
  en: "That's everything! 🎉 I've built my understanding of your business. Next step: add your packages in the Package Builder, then let's do a few role-plays so I can learn how you sell.",
  zh: "全部完成了！🎉 我已经了解你的业务了。下一步：在套餐建立器中添加你的套餐，接着我们来做几个角色扮演，让我学习你的销售方式。",
  ms: "Itu sahaja! 🎉 Saya telah membina pemahaman tentang perniagaan anda. Langkah seterusnya: tambah pakej anda dalam Pembina Pakej, kemudian mari kita jalankan beberapa sesi main peranan supaya saya boleh belajar cara anda menjual.",
};

// Warm conversational acknowledgement. LLM when available, canned otherwise —
// onboarding must work with no API key.
async function buildAck(
  question: string,
  answer: string,
  done: boolean,
  locale: Locale
): Promise<string> {
  const cannedAcks = getCannedAcks(locale);
  const fallback = done ? DONE_FALLBACK[locale] : cannedAcks[Math.floor(Math.random() * cannedAcks.length)];

  if (!llmConfigured()) return fallback;

  try {
    const text = await chatComplete({
      system:
        "You are Mandy, a warm AI sales coordinator interviewing a photographer during setup. Given the question asked and their answer, reply with ONE short, warm, natural acknowledgement sentence (you may briefly reflect their answer back). No follow-up questions — the next question is asked separately. Match their language. Max 25 words.",
      messages: [
        {
          role: "user",
          content: `Question asked: ${question}\nPhotographer's answer: ${answer}${done ? "\n(This was the FINAL question — celebrate finishing setup and mention packages + role-plays are next.)" : ""}`,
        },
      ],
      maxTokens: 120,
      temperature: 0.8,
    });
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}
