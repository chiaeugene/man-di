import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireProfile, UnauthorizedError } from "@/lib/tenant";
import { getGoogleAuthUrl, GoogleOAuthError } from "@/lib/google-calendar/oauth";
import { getPublicOrigin } from "@/lib/http";

const STATE_COOKIE = "gcal_oauth_state";

// Full browser redirect (not a fetch call) — the Settings page links here
// directly. Generates a CSRF nonce, stores it in a short-lived httpOnly
// cookie, and sends the photographer to Google's consent screen.
export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  try {
    await requireProfile();

    const state = crypto.randomBytes(24).toString("hex");
    const redirectUri = `${origin}/api/google-calendar/callback`;
    const authUrl = getGoogleAuthUrl(redirectUri, state);

    const res = NextResponse.redirect(authUrl);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10, // 10 minutes is plenty for the round trip to Google and back
      path: "/",
    });
    return res;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.redirect(`${origin}/login`);
    }
    if (err instanceof GoogleOAuthError) {
      return NextResponse.redirect(`${origin}/settings?calendar=error&message=${encodeURIComponent(err.message)}`);
    }
    console.error("[google-calendar/connect]", err);
    return NextResponse.redirect(`${origin}/settings?calendar=error`);
  }
}
