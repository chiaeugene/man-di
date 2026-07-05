import { requireProfile } from "@/lib/tenant";
import { handle } from "@/lib/api";
import { getInterviewState } from "@/lib/onboarding/interview";

// Current interview state: transcript so far + current brain snapshot.
export async function GET() {
  return handle(async () => {
    const profile = await requireProfile();
    return getInterviewState(profile);
  });
}
