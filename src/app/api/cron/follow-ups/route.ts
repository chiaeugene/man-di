import { NextResponse } from "next/server";
import { runFollowUpsForAllProfiles } from "@/lib/followups";

// Hit periodically by an external scheduler (Render Cron Job, GitHub Actions
// schedule, etc.) — not user-facing. Protected by a shared secret rather than
// session auth since the caller isn't a logged-in browser.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runFollowUpsForAllProfiles();
  return NextResponse.json({ ok: true, results });
}
