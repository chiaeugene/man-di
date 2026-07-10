import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile, UnauthorizedError } from "@/lib/tenant";
import { exchangeCodeForTokens, fetchGoogleAccountEmail, GoogleOAuthError } from "@/lib/google-calendar/oauth";
import { getPublicOrigin } from "@/lib/http";

const STATE_COOKIE = "gcal_oauth_state";

function errorRedirect(origin: string, message: string) {
  const res = NextResponse.redirect(`${origin}/settings?calendar=error&message=${encodeURIComponent(message)}`);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);

  let profile;
  try {
    profile = await requireProfile();
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.redirect(`${origin}/login`);
    throw err;
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    // e.g. the photographer clicked "Cancel" on Google's consent screen.
    return errorRedirect(origin, "Google Calendar connection was cancelled.");
  }

  const cookieStore = req.headers.get("cookie") ?? "";
  const expectedState = cookieStore
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);

  if (!code || !state || !expectedState || state !== expectedState) {
    console.error("[google-calendar/callback] state mismatch or missing code", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasExpected: Boolean(expectedState),
    });
    return errorRedirect(origin, "That connection link expired or was invalid. Please try connecting again.");
  }

  try {
    // Must exactly match the redirect_uri used in /connect — Google validates
    // the two match on token exchange.
    const redirectUri = `${origin}/api/google-calendar/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refreshToken) {
      // Shouldn't happen with access_type=offline&prompt=consent, but if
      // Google ever omits it, we can't maintain access after this session.
      return errorRedirect(origin, "Google didn't grant lasting access. Please try connecting again.");
    }

    const email = await fetchGoogleAccountEmail(tokens.accessToken);

    await prisma.photographerProfile.update({
      where: { id: profile.id },
      data: {
        googleCalendarConnected: true,
        googleRefreshToken: tokens.refreshToken,
        googleCalendarId: "primary",
        googleAccountEmail: email,
      },
    });

    const res = NextResponse.redirect(`${origin}/settings?calendar=connected`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    if (err instanceof GoogleOAuthError) return errorRedirect(origin, err.message);
    console.error("[google-calendar/callback]", err);
    return errorRedirect(origin, "Something went wrong connecting Google Calendar.");
  }
}
