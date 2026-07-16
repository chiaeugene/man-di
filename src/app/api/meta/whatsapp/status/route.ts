import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";
import { embeddedSignupConfigured } from "@/lib/meta/embedded-signup";

// Connection status for the /connect page. Never returns the access token.
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    return {
      configured: embeddedSignupConfigured(),
      connected: Boolean(profile.whatsappPhoneId),
      // Distinguishes self-service connections (token stored per-tenant) from
      // a manual phone-id + env-token setup.
      selfService: Boolean(profile.whatsappAccessToken),
      displayNumber: profile.whatsappDisplayNumber,
      phoneNumberId: profile.whatsappPhoneId,
    };
  });
}
