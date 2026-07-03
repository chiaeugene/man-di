import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { getTrainingScenarios } from "@/lib/training/scenarios";
import { synthesizeStyleProfile } from "@/lib/training/synthesize";
import { getServerLocale } from "@/lib/i18n/server";

const BodySchema = z.object({
  scenarioKey: z.string(),
  reply: z.string().min(1).max(4000),
});

// Store the photographer's natural reply to a mock-customer scenario.
// When the last scenario is answered, synthesize the sales-style profile.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const locale = await getServerLocale();
    const scenarios = getTrainingScenarios(locale);

    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "scenarioKey and reply are required.");

    const scenario = scenarios.find((s) => s.key === body.data.scenarioKey);
    if (!scenario) throw new ApiError(404, "Unknown scenario.");

    // One example per scenario: retraining a scenario replaces the old reply.
    await prisma.trainingExample.deleteMany({
      where: { profileId: profile.id, scenarioKey: scenario.key },
    });
    await prisma.trainingExample.create({
      data: {
        profileId: profile.id,
        scenarioKey: scenario.key,
        customerMessage: scenario.customerMessage,
        photographerReply: body.data.reply.trim(),
      },
    });

    const answered = await prisma.trainingExample.count({ where: { profileId: profile.id } });
    const done = answered >= scenarios.length;

    let styleProfile: string | null = null;
    if (done) {
      styleProfile = await synthesizeStyleProfile(profile);
      await prisma.photographerProfile.update({
        where: { id: profile.id },
        data: { onboardingStatus: "COMPLETED" },
      });
    }

    const answeredKeys = new Set(
      (await prisma.trainingExample.findMany({ where: { profileId: profile.id } })).map(
        (e) => e.scenarioKey
      )
    );
    const next = scenarios.find((s) => !answeredKeys.has(s.key)) ?? null;

    return {
      done,
      styleProfile,
      answeredCount: answered,
      total: scenarios.length,
      next: next
        ? { key: next.key, label: next.label, intro: next.intro, customerMessage: next.customerMessage }
        : null,
    };
  });
}
