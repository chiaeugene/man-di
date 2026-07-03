import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";
import { toJson } from "@/lib/json";

// Wipes interview progress so the photographer can redo the setup interview
// from question 1. Packages and any manual brain edits are left untouched —
// only the raw interview answers + progress are reset; re-completing the
// interview will recompile brand/sales/booking brains over them again.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    await prisma.photographerProfile.update({
      where: { id: profile.id },
      data: {
        onboardingStatus: "NOT_STARTED",
        onboardingStep: 0,
        onboardingAnswers: toJson({}),
      },
    });
    return { ok: true };
  });
}
