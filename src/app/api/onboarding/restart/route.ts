import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";
import { toJson } from "@/lib/json";

// Wipes the setup interview so the photographer can start fresh: clears the
// ONBOARDING conversation transcript and resets all four brains, since with
// the AI-led interview those are built live, turn by turn, as the interview
// itself. Packages (the Package Builder) are untouched.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();

    const conversation = await prisma.conversation.findFirst({
      where: { profileId: profile.id, kind: "ONBOARDING" },
    });
    if (conversation) {
      await prisma.message.deleteMany({ where: { conversationId: conversation.id } });
    }

    await prisma.photographerProfile.update({
      where: { id: profile.id },
      data: {
        onboardingStatus: "NOT_STARTED",
        brandBrain: toJson({}),
        salesBrain: toJson({}),
        bookingBrain: toJson({}),
        packageRules: toJson({}),
      },
    });
    return { ok: true };
  });
}
