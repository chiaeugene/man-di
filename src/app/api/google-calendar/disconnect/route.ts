import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";
import { revokeGoogleToken } from "@/lib/google-calendar/oauth";

export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();

    if (profile.googleRefreshToken) {
      await revokeGoogleToken(profile.googleRefreshToken); // best-effort
    }

    await prisma.photographerProfile.update({
      where: { id: profile.id },
      data: {
        googleCalendarConnected: false,
        googleRefreshToken: null,
        googleCalendarId: null,
        googleAccountEmail: null,
      },
    });

    return { ok: true };
  });
}
