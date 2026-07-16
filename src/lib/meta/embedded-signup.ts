// Server half of Meta Embedded Signup (the "Connect with Facebook" flow on
// /connect). The browser runs Facebook Login for Business and hands us back:
//   - an OAuth `code`
//   - the WABA id + phone number id the user picked (via the SDK's session
//     info message event)
// We exchange the code for a per-tenant business token, subscribe our app to
// the WABA (so its webhooks flow to our existing /api/webhooks/whatsapp), and
// register the phone number for Cloud API sending.
//
// Env: NEXT_PUBLIC_META_APP_ID (app id — public by nature, shared with the
// browser) + META_APP_SECRET, NEXT_PUBLIC_META_WA_CONFIG_ID for the browser
// side, optional META_WA_PIN (two-step verification pin used at registration).
// Same env names as the ecommerce-assistant sibling project, so one Meta app
// setup can serve both.

function apiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || "v21.0";
}

export function embeddedSignupConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_APP_ID && process.env.META_APP_SECRET);
}

export async function exchangeCodeForBusinessToken(code: string): Promise<string | null> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    console.error("[meta signup] NEXT_PUBLIC_META_APP_ID / META_APP_SECRET not configured");
    return null;
  }
  try {
    const url = new URL(`https://graph.facebook.com/${apiVersion()}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    // JS SDK popup code flow — no redirect involved, but the param must be present.
    url.searchParams.set("redirect_uri", "");
    url.searchParams.set("code", code);
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[meta signup] code exchange failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (err) {
    console.error("[meta signup] code exchange error", err);
    return null;
  }
}

// Routes the WABA's webhook traffic to our app (the app-level callback URL is
// configured once in the Meta dashboard; this opts THIS waba into it).
export async function subscribeAppToWaba(wabaId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/${apiVersion()}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error("[meta signup] subscribed_apps failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[meta signup] subscribed_apps error", err);
    return false;
  }
}

// Registers the phone number for Cloud API messaging. Best-effort: numbers
// migrated from the WhatsApp Business app or re-connected ones are often
// already registered, which comes back as an error we can safely ignore.
export async function registerPhoneNumber(phoneNumberId: string, token: string): Promise<void> {
  const pin = process.env.META_WA_PIN || "000000";
  try {
    const res = await fetch(`https://graph.facebook.com/${apiVersion()}/${phoneNumberId}/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    if (!res.ok) {
      console.error("[meta signup] phone register non-ok (often fine if already registered)", res.status, await res.text());
    }
  } catch (err) {
    console.error("[meta signup] phone register error (non-fatal)", err);
  }
}

export async function fetchPhoneNumberInfo(
  phoneNumberId: string,
  token: string
): Promise<{ displayNumber: string | null; verifiedName: string | null }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion()}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return { displayNumber: null, verifiedName: null };
    const json = (await res.json()) as { display_phone_number?: string; verified_name?: string };
    return { displayNumber: json.display_phone_number ?? null, verifiedName: json.verified_name ?? null };
  } catch {
    return { displayNumber: null, verifiedName: null };
  }
}
