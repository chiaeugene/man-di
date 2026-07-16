"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconChat, IconCamera, IconCheckCircle, IconAlert } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// Meta Embedded Signup ("Connect with Facebook"). The FB SDK opens Meta's
// hosted dialog where the photographer logs in and picks their WhatsApp
// number; Meta then hands back (1) an OAuth code via the login callback and
// (2) the chosen WABA/phone ids via a window message event. Both arrive in
// either order — we complete the connect once we have the pair.

interface FbLoginResponse {
  authResponse?: { code?: string } | null;
}

interface FbSdk {
  init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(
    cb: (response: FbLoginResponse) => void,
    opts: {
      config_id: string;
      response_type: string;
      override_default_response_type: boolean;
      extras: Record<string, unknown>;
    }
  ): void;
}

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

interface WhatsAppStatus {
  configured: boolean;
  connected: boolean;
  selfService: boolean;
  displayNumber: string | null;
  phoneNumberId: string | null;
}

// Same env names as the ecommerce-assistant sibling project — one Meta app
// setup serves both.
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "";
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_WA_CONFIG_ID || "";

export default function ConnectPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState<string | null>(null);

  // The OAuth code and the session-info (waba/phone ids) arrive independently.
  const codeRef = useRef<string | null>(null);
  const sessionRef = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);

  function loadStatus() {
    fetch("/api/meta/whatsapp/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }

  useEffect(() => {
    loadStatus();
  }, []);

  // Load the Facebook JS SDK once.
  useEffect(() => {
    if (!META_APP_ID) return;
    if (window.FB) {
      // Already loaded (e.g. client-side navigation back to this page).
      queueMicrotask(() => setSdkReady(true));
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
      setSdkReady(true);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const tryComplete = useCallback(async () => {
    const code = codeRef.current;
    const session = sessionRef.current;
    if (!code || !session) return;
    codeRef.current = null;
    sessionRef.current = null;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/meta/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wabaId: session.wabaId, phoneNumberId: session.phoneNumberId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("connect.genericError"));
      } else {
        setJustConnected(json.displayNumber ?? null);
        loadStatus();
      }
    } catch {
      setError(t("connect.genericError"));
    } finally {
      setBusy(false);
    }
  }, [t]);

  // Meta posts the picked WABA/phone ids from the signup dialog.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Exact origins only — a suffix check would also match e.g. "evilfacebook.com".
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA") {
          const phoneNumberId = data.data?.phone_number_id;
          const wabaId = data.data?.waba_id;
          if (phoneNumberId && wabaId) {
            sessionRef.current = { wabaId, phoneNumberId };
            void tryComplete();
          } else {
            setError(t("connect.noNumberPicked"));
          }
        } else if (data.event === "CANCEL") {
          setBusy(false);
        } else if (data.event === "ERROR") {
          setBusy(false);
          setError(data.data?.error_message || t("connect.genericError"));
        }
      } catch {
        // Not our message — ignore.
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [t, tryComplete]);

  function launchWhatsAppSignup() {
    if (!window.FB || !META_CONFIG_ID) return;
    setError(null);
    setJustConnected(null);
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (code) {
          codeRef.current = code;
          void tryComplete();
        } else {
          setBusy(false);
        }
      },
      {
        config_id: META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  }

  async function disconnect() {
    if (!confirm(t("connect.disconnectConfirm"))) return;
    setBusy(true);
    await fetch("/api/meta/whatsapp/disconnect", { method: "POST" });
    setBusy(false);
    setJustConnected(null);
    loadStatus();
  }

  const envReady = Boolean(META_APP_ID && META_CONFIG_ID) && (status?.configured ?? false);

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <p className="eyebrow">{t("connect.eyebrow")}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("connect.title")}</h1>
      <p className="mb-6 mt-1.5 text-sm text-wine-soft/70">{t("connect.subtitle")}</p>

      {justConnected !== null && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <IconCheckCircle size={16} />
          {t("connect.connectedBanner")} {justConnected && <span className="tabular-nums">{justConnected}</span>}
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <IconAlert size={16} />
          {error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="flex flex-col rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-emerald-600"><IconChat size={16} /></span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t("connect.whatsappTitle")}</h2>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-wine-soft/60">{t("connect.whatsappDesc")}</p>

          <div className="mt-auto">
            {!status ? (
              <p className="text-xs text-wine-soft/50">{t("common.loading")}</p>
            ) : status.connected ? (
              <div>
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                  <IconCheckCircle size={15} />
                  {t("connect.whatsappConnectedAs")}{" "}
                  <span className="tabular-nums">{status.displayNumber || status.phoneNumberId}</span>
                </p>
                {!status.selfService && (
                  <p className="mb-3 text-xs text-wine-soft/50">{t("connect.manualConnectionNote")}</p>
                )}
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={busy}
                  className="cursor-pointer rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-wine-soft transition-colors duration-150 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("connect.disconnect")}
                </button>
              </div>
            ) : envReady ? (
              <button
                type="button"
                onClick={launchWhatsAppSignup}
                disabled={!sdkReady || busy}
                className="w-full cursor-pointer rounded-full bg-[#1877F2] px-5 py-3 text-sm font-bold text-white shadow-petal transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? t("connect.connecting") : t("connect.connectWithFacebook")}
              </button>
            ) : (
              <p className="flex items-start gap-1.5 text-xs font-medium text-amber-600">
                <IconAlert size={13} className="mt-0.5 shrink-0" />
                {t("connect.notConfigured")}
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col rounded-3xl border border-rose-100 bg-white/60 p-6 shadow-petal">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-rose-400"><IconCamera size={16} /></span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft/60">{t("connect.messengerTitle")}</h2>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-wine-soft/50">{t("connect.messengerDesc")}</p>
          <div className="mt-auto">
            <span className="inline-block rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-400">
              {t("connect.comingSoon")}
            </span>
          </div>
        </section>
      </div>

      <p className="mt-6 text-xs text-wine-soft/50">
        {t("connect.advancedPrefix")}{" "}
        <Link href="/settings" className="cursor-pointer font-semibold text-rose-600 underline underline-offset-2">
          {t("connect.advancedLink")}
        </Link>
      </p>
    </div>
  );
}
