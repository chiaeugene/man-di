import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";
import { parseJson } from "@/lib/json";
import { getOnboardingSteps, getSectionLabels } from "@/lib/onboarding/steps";
import { getServerLocale } from "@/lib/i18n/server";

// Current interview state: transcript so far + next question.
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    const locale = await getServerLocale();
    const steps = getOnboardingSteps(locale);
    const sectionLabels = getSectionLabels(locale);

    const answers = parseJson<Record<string, string>>(profile.onboardingAnswers, {});
    const step = Math.min(profile.onboardingStep, steps.length);

    const transcript = steps.slice(0, step).flatMap((s) => [
      { role: "MANDY", content: s.question },
      { role: "PHOTOGRAPHER", content: answers[s.id] ?? "" },
    ]);

    const next = step < steps.length ? steps[step] : null;

    return {
      status: profile.onboardingStatus,
      step,
      totalSteps: steps.length,
      transcript,
      nextQuestion: next
        ? { id: next.id, section: sectionLabels[next.section], question: next.question }
        : null,
      done: step >= steps.length,
    };
  });
}
