import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";

// Clears the tenant's WhatsApp connection. Only touches our own DB — the
// Meta-side grant stays until revoked in Meta Business settings, which is
// fine: without the stored token/phone id we never act on it again.
export async function POST() {
  return handle(async () => {
    const profile = await requireProfile();
    await prisma.photographerProfile.update({
      where: { id: profile.id },
      data: {
        whatsappPhoneId: null,
        whatsappAccessToken: null,
        whatsappWabaId: null,
        whatsappDisplayNumber: null,
      },
    });
    return { connected: false };
  });
}
