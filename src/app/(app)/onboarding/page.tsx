"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatWindow, type ChatMsg } from "@/components/Chat";
import {
  IconCheck,
  IconCheckCircle,
  IconFileText,
  IconLink,
  IconPaperclip,
  IconTrash,
} from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface Brain {
  [key: string]: string;
}

interface Doc {
  id: string;
  fileName: string;
  sourceType: string;
  sourceUrl: string | null;
  sizeBytes: number;
  preview: string;
}

const CHECKLIST = [
  { key: "brandBrain", labelKey: "onboarding.checklistBrand" },
  { key: "packageRules", labelKey: "onboarding.checklistPricing" },
  { key: "salesBrain", labelKey: "onboarding.checklistSales" },
  { key: "bookingBrain", labelKey: "onboarding.checklistBooking" },
] as const;

function hasContent(brain: Brain | undefined) {
  return Boolean(brain && Object.values(brain).some((v) => v && v.trim()));
}

export default function OnboardingPage() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<string>("NOT_STARTED");
  const [brains, setBrains] = useState<Record<string, Brain>>({});
  const [readyToWrapUp, setReadyToWrapUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsOpen, setDocsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const done = status === "TRAINING" || status === "COMPLETED";

  useEffect(() => {
    fetch("/api/onboarding")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setBlocked(data.error ?? "Something went wrong.");
          setLoaded(true);
          return;
        }
        const transcript: ChatMsg[] = (data.transcript ?? []).map((m: { role: string; content: string }) => ({
          role: m.role === "MANDY" ? "mandy" : "me",
          content: m.content,
        }));
        setMessages(transcript);
        setStatus(data.status);
        setBrains({
          brandBrain: data.brandBrain,
          salesBrain: data.salesBrain,
          bookingBrain: data.bookingBrain,
          packageRules: data.packageRules,
        });
        setLoaded(true);
      })
      .catch(() => {
        setBlocked("Something went wrong.");
        setLoaded(true);
      });
    fetch("/api/onboarding/documents")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []));
  }, [locale]);

  async function send(text: string) {
    setMessages((m) => [...m, { role: "me", content: text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "system", content: data.error ?? "Something went wrong." }]);
        return;
      }
      setMessages((m) => [...m, { role: "mandy", content: data.reply }]);
      setReadyToWrapUp(Boolean(data.readyToWrapUp));
      setBrains({
        brandBrain: data.brandBrain,
        salesBrain: data.salesBrain,
        bookingBrain: data.bookingBrain,
        packageRules: data.packageRules,
      });
      setStatus((s) => (s === "NOT_STARTED" ? "INTERVIEW" : s));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/finish", { method: "POST" });
      if (res.ok) setStatus("TRAINING");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setDocBusy(true);
    setDocError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/onboarding/documents", { method: "POST", body: form });
    const data = await res.json();
    setDocBusy(false);
    if (!res.ok) {
      setDocError(data.error ?? "Upload failed.");
      return;
    }
    setDocs((d) => [...d, data.document]);
  }

  async function addUrl() {
    if (!urlInput.trim()) return;
    setDocBusy(true);
    setDocError(null);
    const res = await fetch("/api/onboarding/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput.trim() }),
    });
    const data = await res.json();
    setDocBusy(false);
    if (!res.ok) {
      setDocError(data.error ?? "Could not fetch that URL.");
      return;
    }
    setDocs((d) => [...d, data.document]);
    setUrlInput("");
  }

  async function addPastedText() {
    if (!pasteText.trim()) return;
    setDocBusy(true);
    setDocError(null);
    const res = await fetch("/api/onboarding/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pasteText.trim() }),
    });
    const data = await res.json();
    setDocBusy(false);
    if (!res.ok) {
      setDocError(data.error ?? "Could not save that text.");
      return;
    }
    setDocs((d) => [...d, data.document]);
    setPasteText("");
    setPasteOpen(false);
  }

  async function removeDoc(id: string) {
    const res = await fetch(`/api/onboarding/documents/${id}`, { method: "DELETE" });
    if (res.ok) setDocs((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("onboarding.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("onboarding.title")}</h1>
          <p className="mt-1.5 text-sm text-wine-soft/70">{t("onboarding.subtitle")}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        {CHECKLIST.map(({ key, labelKey }) => {
          const filled = hasContent(brains[key]);
          return (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                filled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-100 bg-white text-wine-soft/50"
              }`}
            >
              {filled ? (
                <IconCheck size={11} className="text-emerald-600" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-rose-200" />
              )}
              {t(labelKey)}
            </span>
          );
        })}
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

      {!done && (
        <div className="mb-5 rounded-2xl border border-rose-100 bg-white shadow-petal">
          <button
            type="button"
            onClick={() => setDocsOpen((o) => !o)}
            className="flex w-full cursor-pointer items-center justify-between gap-2 px-5 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-wine">
              <IconPaperclip size={15} className="text-rose-400" />
              {t("onboarding.referenceMaterials")}
              {docs.length > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                  {docs.length}
                </span>
              )}
            </span>
            <span className="text-xs text-wine-soft/50">{docsOpen ? t("common.hide") : t("common.show")}</span>
          </button>
          {docsOpen && (
            <div className="border-t border-rose-50 p-5 pt-4">
              <p className="mb-3 text-xs text-wine-soft/50">{t("onboarding.referenceMaterialsHint")}</p>
              {docs.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/40 px-3 py-2 text-xs text-wine"
                    >
                      {d.sourceType === "URL" ? (
                        <IconLink size={14} className="shrink-0 text-rose-400" />
                      ) : (
                        <IconFileText size={14} className="shrink-0 text-rose-400" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{d.fileName}</span>
                      <button
                        onClick={() => removeDoc(d.id)}
                        aria-label={t("common.delete")}
                        className="shrink-0 cursor-pointer text-wine-soft/40 transition-colors duration-150 hover:text-red-600"
                      >
                        <IconTrash size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {docError && <p className="mb-2 text-xs text-red-600">{docError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) uploadFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={docBusy}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-wine-soft transition-colors duration-150 hover:bg-rose-50 disabled:opacity-50"
                >
                  <IconPaperclip size={13} /> {t("onboarding.uploadFile")}
                </button>
                <button
                  type="button"
                  onClick={() => setPasteOpen((o) => !o)}
                  disabled={docBusy}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-wine-soft transition-colors duration-150 hover:bg-rose-50 disabled:opacity-50"
                >
                  <IconFileText size={13} /> {t("onboarding.pasteText")}
                </button>
                <div className="flex min-w-[200px] flex-1 items-center gap-1.5">
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={t("onboarding.urlPlaceholder")}
                    className="min-w-0 flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                  />
                  <button
                    type="button"
                    onClick={addUrl}
                    disabled={docBusy || !urlInput.trim()}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-wine-soft transition-colors duration-150 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <IconLink size={13} /> {t("onboarding.fetchUrl")}
                  </button>
                </div>
              </div>
              {pasteOpen && (
                <div className="mt-3">
                  <textarea
                    rows={4}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={t("onboarding.pasteTextPlaceholder")}
                    className="w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                  />
                  <button
                    type="button"
                    onClick={addPastedText}
                    disabled={docBusy || !pasteText.trim()}
                    className="mt-2 cursor-pointer rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-wine-soft transition-colors duration-150 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {t("common.save")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-wine-soft/50">{t("common.loading")}</p>
      ) : blocked ? (
        <div className="rounded-3xl border border-amber-200 bg-champagne p-6 text-sm text-amber-900 shadow-petal">
          {blocked}
        </div>
      ) : (
        <>
          <ChatWindow
            messages={messages}
            onSend={send}
            busy={busy}
            disabled={done}
            placeholder={done ? t("onboarding.interviewCompletePlaceholder") : t("onboarding.typeAnswer")}
          />
          {!done && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-wine-soft/50">
                {readyToWrapUp ? t("onboarding.readyToWrapUpHint") : t("onboarding.skipHint")}
              </p>
              <button
                onClick={finish}
                disabled={busy}
                className="shrink-0 cursor-pointer rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-wine-soft transition-colors duration-150 hover:bg-rose-50 disabled:opacity-50"
              >
                {t("onboarding.finishForNow")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
