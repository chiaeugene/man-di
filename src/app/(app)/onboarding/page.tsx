"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatWindow, type ChatMsg } from "@/components/Chat";
import { IconCheckCircle } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface NextQuestion {
  id: string;
  section: string;
  question: string;
}

export default function OnboardingPage() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [next, setNext] = useState<NextQuestion | null>(null);
  const [progress, setProgress] = useState({ step: 0, total: 1 });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        const transcript: ChatMsg[] = (data.transcript ?? [])
          .filter((m: { content: string }) => m.content && m.content.trim())
          .map((m: { role: string; content: string }) => ({
            role: m.role === "MANDY" ? "mandy" : "me",
            content: m.content,
          }));
        if (data.nextQuestion) {
          transcript.push({
            role: "mandy",
            content: data.nextQuestion.question,
            badge: data.nextQuestion.section,
          });
        }
        setMessages(transcript);
        setNext(data.nextQuestion);
        setProgress({ step: data.step, total: data.totalSteps });
        setDone(data.done);
        setLoaded(true);
      });
  }, [locale]);

  async function submit(body: { message: string } | { skip: true }) {
    if ("message" in body) setMessages((m) => [...m, { role: "me", content: body.message }]);
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "system", content: data.error ?? "Something went wrong." }]);
        return;
      }
      const additions: ChatMsg[] = [{ role: "mandy", content: data.ack }];
      if (data.nextQuestion) {
        additions.push({
          role: "mandy",
          content: data.nextQuestion.question,
          badge: data.nextQuestion.section,
        });
      }
      setMessages((m) => [...m, ...additions]);
      setNext(data.nextQuestion);
      setProgress({ step: data.step, total: data.totalSteps });
      setDone(data.done);
    } finally {
      setBusy(false);
    }
  }

  function send(text: string) {
    return submit({ message: text });
  }

  function skip() {
    return submit({ skip: true });
  }

  const pct = Math.round((progress.step / progress.total) * 100);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("onboarding.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("onboarding.title")}</h1>
          <p className="mt-1.5 text-sm text-wine-soft/70">{t("onboarding.subtitle")}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-2xl font-bold tabular-nums text-rose-600">{pct}%</span>
        </div>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-rose-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 via-pink-500 to-rose-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {loaded && done && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 shadow-petal">
          <IconCheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <p>
            {t("onboarding.interviewComplete")}{" "}
            <Link href="/packages" className="font-semibold underline underline-offset-2">
              {t("onboarding.addYourPackages")}
            </Link>{" "}
            {t("onboarding.then")}{" "}
            <Link href="/training" className="font-semibold underline underline-offset-2">
              {t("onboarding.runSalesRolePlays")}
            </Link>
            {t("onboarding.period")}
          </p>
        </div>
      )}

      {loaded ? (
        <>
          <ChatWindow
            messages={messages}
            onSend={send}
            busy={busy}
            disabled={done || !next}
            placeholder={done ? t("onboarding.interviewCompletePlaceholder") : t("onboarding.typeAnswer")}
          />
          {!done && next && (
            <button
              onClick={skip}
              disabled={busy}
              className="mt-3 cursor-pointer text-xs font-medium text-wine-soft/50 underline-offset-2 transition-colors duration-150 hover:text-rose-600 hover:underline disabled:opacity-50"
            >
              {t("onboarding.skipQuestion")}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-wine-soft/50">{t("common.loading")}</p>
      )}
    </div>
  );
}
