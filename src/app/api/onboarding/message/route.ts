import { z } from "zod";
import { requireProfile } from "@/lib/tenant";
import { handle, ApiError } from "@/lib/api";
import { runInterviewTurn } from "@/lib/onboarding/interview";

const BodySchema = z.object({ message: z.string().min(1).max(4000) });

// One turn of the AI-led setup interview: photographer's message in, Mandy's
// reply out, brains updated incrementally with whatever she just learned.
export async function POST(req: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) throw new ApiError(400, "Message is required.");

    return runInterviewTurn(profile, body.data.message.trim());
  });
}
