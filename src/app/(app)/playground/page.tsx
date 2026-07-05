"use client";

import { useState } from "react";
import Link from "next/link";
import { ChatWindow, type ChatMsg } from "@/components/Chat";
import { ChannelBadge } from "@/components/ChannelBadge";
import { IconAlert, IconArrowRight, IconFlask, IconSparkles } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function PlaygroundPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [takeover, setTakeover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startSession() {
    setBusy(true);
    try {
      const res = await fetch("/api/playground/session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessages([{ role: "system", content: data.error ?? "Could not start session." }]);
        return;
      }
      setConversationId(data.conversationId);
      setLeadId(data.leadId);
      setStatus("New Lead");
      setTakeover(null);
      setMessages([{ role: "system", content: t("playground.sessionStarted") }]);
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string) {
    if (!conversationId) return;
    setMessages((m) => [...m, { role: "me", content: text, badge: t("leadDetail.you") + " (customer)" }]);
    setBusy(true);
    try {
      const res = await fetch("/api/playground/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "system", content: data.error ?? "Something went wrong." }]);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "mandy",
          content: data.reply,
          badge: `${t("leadDetail.mandy")} · ${data.detectedLanguage}`,
          attachments: data.attachments,
        },
      ]);
      setStatus(data.status);
      if (data.takeover?.needed) {
        const reason = data.takeover.reason ?? t("playground.takeoverGeneric");
        setTakeover(reason);
        setMessages((m) => [
          ...m,
          {
            role: "system",
            content: `${t("playground.takeoverTriggered")} ${reason} ${t("playground.takeoverExplain")}`,
          },
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("playground.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("playground.title")}</h1>
          <p className="mt-1.5 text-sm text-wine-soft/70">{t("playground.subtitle")}</p>
        </div>
        <button
          onClick={startSession}
          disabled={busy}
          className="shrink-0 cursor-pointer rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:shadow-petal-lg hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
        >
          {conversationId ? t("playground.newSession") : t("playground.startSession")}
        </button>
      </div>

      {status && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-100 bg-white px-5 py-3 text-sm shadow-petal">
          <ChannelBadge source="PLAYGROUND" />
          <span className="text-wine-soft/60">{t("playground.leadStatus")}</span>
          <span className="font-bold text-wine">{t(`leadStatus.${status}`)}</span>
          {takeover && (
            <span className="flex items-center gap-1.5 text-rose-600">
              <IconAlert size={13} /> {takeover}
            </span>
          )}
          {leadId && (
            <Link
              href={`/leads/${leadId}`}
              className="ml-auto inline-flex cursor-pointer items-center gap-1 font-semibold text-rose-600 transition-colors duration-150 hover:text-rose-700"
            >
              {t("playground.viewLead")} <IconArrowRight size={13} />
            </Link>
          )}
        </div>
      )}

      {conversationId ? (
        <ChatWindow
          messages={messages}
          onSend={send}
          busy={busy}
          disabled={Boolean(takeover)}
          placeholder={takeover ? t("playground.placeholderTakeover") : t("playground.placeholderTry")}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-12 text-center shadow-petal">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-pink-50 text-rose-500">
            <IconFlask size={26} />
          </span>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-wine-soft/70">
            {t("playground.emptyStatePrefix")}{" "}
            <Link href="/onboarding" className="font-semibold text-rose-600 underline underline-offset-2">
              {t("playground.emptyStateInterview")}
            </Link>{" "}
            {t("playground.emptyStateAnd")}{" "}
            <Link href="/packages" className="font-semibold text-rose-600 underline underline-offset-2">
              {t("playground.emptyStatePackages")}
            </Link>{" "}
            {t("playground.emptyStateSuffix")}
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-wine-soft/50">
            <IconSparkles size={12} className="text-gold" />
            {t("playground.requiresApiKey")}
          </p>
        </div>
      )}
    </div>
  );
}
