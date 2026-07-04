"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatWindow, type ChatMsg } from "@/components/Chat";
import { IconArrowRight, IconCheck, IconCheckCircle } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface Scenario {
  key: string;
  label: string;
  intro: string;
  customerMessage: string;
}

interface ScenarioSummary extends Scenario {
  learns: string;
  answered: boolean;
}

export default function TrainingPage() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [current, setCurrent] = useState<Scenario | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [progress, setProgress] = useState({ answered: 0, total: 12 });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/training")
      .then((r) => r.json())
      .then((data) => {
        setScenarios(data.scenarios ?? []);
        setProgress({ answered: data.answeredCount, total: data.total });
        setDone(data.done);
        if (data.next) {
          setCurrent(data.next);
          setMessages([
            { role: "mandy", content: data.next.intro },
            { role: "mandy", content: data.next.customerMessage, badge: `${t("training.mockCustomer")} — ${data.next.label}` },
          ]);
        } else if (data.done) {
          setMessages([{ role: "mandy", content: t("training.doneMessage") }]);
        }
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Training never "locks" — clicking any scenario (answered or not) loads
  // its role-play prompt again so the photographer can redo it any time.
  function selectScenario(s: ScenarioSummary) {
    setCurrent({ key: s.key, label: s.label, intro: s.intro, customerMessage: s.customerMessage });
    setMessages([
      { role: "mandy", content: s.intro },
      { role: "mandy", content: s.customerMessage, badge: `${t("training.mockCustomer")} — ${s.label}` },
    ]);
  }

  async function send(text: string) {
    if (!current) return;
    setMessages((m) => [...m, { role: "me", content: text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/training/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioKey: current.key, reply: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "system", content: data.error ?? "Something went wrong." }]);
        return;
      }
      setProgress({ answered: data.answeredCount, total: data.total });
      setScenarios((s) => s.map((x) => (x.key === current.key ? { ...x, answered: true, reply: text } : x)));
      setDone(data.done);
      if (data.next) {
        setCurrent(data.next);
        setMessages((m) => [
          ...m,
          { role: "mandy", content: t("training.learnedThat") },
          { role: "mandy", content: data.next.intro },
          { role: "mandy", content: data.next.customerMessage, badge: `${t("training.mockCustomer")} — ${data.next.label}` },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "mandy",
            content: data.styleProfile
              ? `${t("training.doneMessageWithStyle")}\n\n${data.styleProfile}`
              : t("training.learnedThat"),
          },
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl gap-6 animate-fade-up">
      <div className="min-w-0 flex-1">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t("training.eyebrow")}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("training.title")}</h1>
            <p className="mt-1.5 text-sm text-wine-soft/70">{t("training.subtitle")}</p>
          </div>
          <span className="shrink-0 text-2xl font-bold tabular-nums text-rose-600">
            {progress.answered}
            <span className="text-sm font-semibold text-wine-soft/40">/{progress.total}</span>
          </span>
        </div>
        {loaded && done && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 shadow-petal">
            <IconCheckCircle size={18} className="shrink-0 text-emerald-600" />
            <p>
              {t("training.trainingComplete")}{" "}
              <Link href="/playground" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                {t("training.testInPlayground")} <IconArrowRight size={13} />
              </Link>
              {" — "}
              {t("training.redoHint")}
            </p>
          </div>
        )}
        {loaded ? (
          <ChatWindow
            messages={messages}
            onSend={send}
            busy={busy}
            disabled={!current}
            placeholder={current ? t("training.replyPlaceholder") : t("training.allComplete")}
          />
        ) : (
          <p className="text-sm text-wine-soft/50">{t("common.loading")}</p>
        )}
      </div>
      <aside className="hidden w-60 shrink-0 lg:block">
        <h2 className="eyebrow mb-3">{t("training.scenariosHeading")}</h2>
        <ul className="space-y-1.5">
          {scenarios.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => selectScenario(s)}
                title={s.learns}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-colors duration-150 ${
                  s.answered
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    : s.key === current?.key
                      ? "border-rose-300 bg-rose-50 text-rose-800 shadow-petal"
                      : "border-rose-100 bg-white text-wine-soft/70 hover:bg-rose-50"
                }`}
              >
                {s.answered ? (
                  <IconCheck size={12} className="shrink-0 text-emerald-600" />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      s.key === current?.key ? "animate-pulse bg-rose-500" : "bg-rose-200"
                    }`}
                  />
                )}
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
