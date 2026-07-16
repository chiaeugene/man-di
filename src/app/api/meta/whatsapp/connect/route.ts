import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import {
  embeddedSignupConfigured,
  exchangeCodeForBusinessToken,
  subscribeAppToWaba,
  registerPhoneNumber,
  fetchPhoneNumberInfo,
} from "@/lib/meta/embedded-signup";

const BodySchema = z.object({
  code: z.string().min(1).max(2000),
  wabaId: z.string().min(1).max(100),
  phoneNumberId: z.string().min(1).max(100),
});

// Completes Meta Embedded Signup: the browser already ran the Facebook
// dialog and gives us the OAuth code plus the WABA/phone the user picked.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    if (!embeddedSignupConfigured()) {
      throw new ApiError(503, "Meta app credentials are not configured on the server.");
    }
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Invalid connect payload.");
    const { code, wabaId, phoneNumberId } = body.data;

    // Another tenant already routing this number would silently steal its
    // webhook traffic — refuse instead.
    const clash = await prisma.photographerProfile.findFirst({
      where: { whatsappPhoneId: phoneNumberId, NOT: { id: profile.id } },
      select: { id: true },
    });
    if (clash) throw new ApiError(409, "This WhatsApp number is already connected to another account.");

    const token = await exchangeCodeForBusinessToken(code);
    if (!token) throw new ApiError(502, "Could not exchange the Facebook code for an access token. Please try again.");

    const subscribed = await subscribeAppToWaba(wabaId, token);
    if (!subscribed) throw new ApiError(502, "Could not subscribe to the WhatsApp Business Account. Please try again.");

    // Best-effort — often already registered.
    await registerPhoneNumber(phoneNumberId, token);

    const info = await fetchPhoneNumberInfo(phoneNumberId, token);

    await prisma.photographerProfile.update({
      where: { id: profile.id },
      data: {
        whatsappPhoneId: phoneNumberId,
        whatsappAccessToken: token,
        whatsappWabaId: wabaId,
        whatsappDisplayNumber: info.displayNumber,
      },
    });

    return {
      connected: true,
      displayNumber: info.displayNumber,
      verifiedName: info.verifiedName,
    };
  });
}
