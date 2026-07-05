import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";

// Photographer decides they're done for now (there's no fixed step count to
// finish automatically) — advances to the training role-plays.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    if (profile.onboardingStatus === "NOT_STARTED" || profile.onboardingStatus === "INTERVIEW") {
      await prisma.photographerProfile.update({
        where: { id: profile.id },
        data: { onboardingStatus: "TRAINING" },
      });
    }
    return { ok: true };
  });
}
