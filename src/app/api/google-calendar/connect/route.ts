import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireProfile, UnauthorizedError } from "@/lib/tenant";
import { getGoogleAuthUrl, GoogleOAuthError } from "@/lib/google-calendar/oauth";

const STATE_COOKIE = "gcal_oauth_state";

// Full browser redirect (not a fetch call) — the Settings page links here
// directly. Generates a CSRF nonce, stores it in a short-lived httpOnly
// cookie, and sends the photographer to Google's consent screen.
export async function GET(req: Request) {
  try {
    await requireProfile();

    const state = crypto.randomBytes(24).toString("hex");
    const redirectUri = new URL("/api/google-calendar/callback", req.url).toString();
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
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (err instanceof GoogleOAuthError) {
      return NextResponse.redirect(new URL(`/settings?calendar=error&message=${encodeURIComponent(err.message)}`, req.url));
    }
    console.error("[google-calendar/connect]", err);
    return NextResponse.redirect(new URL("/settings?calendar=error", req.url));
  }
}
