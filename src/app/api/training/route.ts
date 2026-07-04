import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";
import { getTrainingScenarios } from "@/lib/training/scenarios";
import { getServerLocale } from "@/lib/i18n/server";

// Training progress: which scenarios are answered, what's next.
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const locale = await getServerLocale();
    const scenarios = getTrainingScenarios(locale);

    const examples = await prisma.trainingExample.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "asc" },
    });
    const answeredKeys = new Set(examples.map((e) => e.scenarioKey));
    const next = scenarios.find((s) => !answeredKeys.has(s.key)) ?? null;

    return {
      // intro/customerMessage included for every scenario (not just the next
      // unanswered one) so a photographer can click any scenario, done or
      // not, and redo it — training never "locks" once complete.
      scenarios: scenarios.map((s) => ({
        key: s.key,
        label: s.label,
        intro: s.intro,
        customerMessage: s.customerMessage,
        learns: s.learns,
        answered: answeredKeys.has(s.key),
        reply: examples.find((e) => e.scenarioKey === s.key)?.photographerReply ?? null,
      })),
      next: next
        ? { key: next.key, label: next.label, intro: next.intro, customerMessage: next.customerMessage }
        : null,
      answeredCount: answeredKeys.size,
      total: scenarios.length,
      done: answeredKeys.size >= scenarios.length,
    };
  });
}
