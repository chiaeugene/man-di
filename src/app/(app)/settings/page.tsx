"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconHeart, IconSparkles, IconWallet, IconChat, IconCalendar, IconAlert, IconCheckCircle } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Brain = Record<string, string>;

interface SettingsData {
  brandBrain: Brain;
  salesBrain: Brain;
  bookingBrain: Brain;
  whatsappPhoneId: string;
  maxBookingsPerDay: number | null;
  autoConfirmPayments: boolean;
  sessionDurationMinutes: number | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  bufferMinutes: number | null;
  workingDays: string | null;
  minAdvanceNoticeHours: number | null;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface GoogleCalendarState {
  connected: boolean;
  accountEmail: string | null;
}

const BRAND_KEYS = [
  "photographerName",
  "studioName",
  "location",
  "category",
  "targetCustomer",
  "photographyStyle",
  "brandPersonality",
  "values",
  "toneOfVoice",
  "languageStyle",
  "differentiators",
  "offerings",
] as const;

const SALES_KEYS = [
  "conversationStrategy",
  "upsellStrategy",
  "photographerPreferences",
  "discountRules",
  "followUpRules",
  "allowedToSay",
  "neverSay",
  "salesPressure",
  "styleProfile",
] as const;

const BOOKING_KEYS = [
  "depositAmount",
  "paymentMethods",
  "paymentInstructions",
  "balanceRules",
  "cancellationPolicy",
  "consultationRules",
  "availabilityRules",
  "humanOnlyTopics",
] as const;

const WIDE_KEYS = new Set([
  "paymentInstructions",
  "styleProfile",
  "conversationStrategy",
  "upsellStrategy",
  "photographerPreferences",
]);

const SECTION_META: Record<string, { Icon: typeof IconHeart; color: string }> = {
  brandBrain: { Icon: IconHeart, color: "text-rose-500" },
  salesBrain: { Icon: IconSparkles, color: "text-gold" },
  bookingBrain: { Icon: IconWallet, color: "text-emerald-600" },
};

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SettingsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [gcal, setGcal] = useState<GoogleCalendarState | null>(null);
  const [gcalBusy, setGcalBusy] = useState(false);

  // Lazy initializer reads the URL only on the very first render, capturing
  // it into real state — if this were derived from searchParams on every
  // render instead, the banner would vanish the instant the cleanup effect
  // below strips the query param (a flash instead of a persistent message).
  const [gcalBanner] = useState<{ type: "connected" } | { type: "error"; message?: string } | null>(() => {
    const calendar = searchParams.get("calendar");
    if (calendar === "connected") return { type: "connected" };
    if (calendar === "error") return { type: "error", message: searchParams.get("message") ?? undefined };
    return null;
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setData({
          brandBrain: d.brandBrain ?? {},
          salesBrain: d.salesBrain ?? {},
          bookingBrain: d.bookingBrain ?? {},
          whatsappPhoneId: d.whatsappPhoneId ?? "",
          maxBookingsPerDay: d.maxBookingsPerDay ?? null,
          autoConfirmPayments: Boolean(d.autoConfirmPayments),
          sessionDurationMinutes: d.sessionDurationMinutes ?? null,
          workingHoursStart: d.workingHoursStart ?? null,
          workingHoursEnd: d.workingHoursEnd ?? null,
          bufferMinutes: d.bufferMinutes ?? null,
          workingDays: d.workingDays ?? null,
          minAdvanceNoticeHours: d.minAdvanceNoticeHours ?? null,
        });
        setGcal({ connected: Boolean(d.googleCalendarConnected), accountEmail: d.googleAccountEmail ?? null });
      });
  }, []);

  useEffect(() => {
    if (searchParams.get("calendar")) router.replace("/settings");
  }, [searchParams, router]);

  async function disconnectGoogleCalendar() {
    if (!confirm(t("settings.googleCalendarDisconnectConfirm"))) return;
    setGcalBusy(true);
    const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
    setGcalBusy(false);
    if (res.ok) setGcal({ connected: false, accountEmail: null });
  }

  async function save() {
    if (!data) return;
    setBusy(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function restartInterview() {
    if (!confirm(t("settings.restartConfirm"))) return;
    setRestarting(true);
    const res = await fetch("/api/onboarding/restart", { method: "POST" });
    if (res.ok) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setRestarting(false);
    }
  }

  if (!data) return <p className="text-sm text-wine-soft/50">{t("common.loading")}</p>;

  const renderSection = (
    brainKey: "brandBrain" | "salesBrain" | "bookingBrain",
    keys: readonly string[]
  ) => {
    const { Icon, color } = SECTION_META[brainKey];
    return (
      <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
        <div className="mb-1 flex items-center gap-2">
          <span className={color}><Icon size={15} /></span>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t(`settings.${brainKey}`)}</h2>
        </div>
        <p className="mb-5 text-xs text-wine-soft/50">{t(`settings.${brainKey}Desc`)}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {keys.map((key) => (
            <div key={key} className={WIDE_KEYS.has(key) ? "sm:col-span-2" : ""}>
              <label htmlFor={`${brainKey}-${key}`} className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
                {t(`settings.fields.${key}`)}
              </label>
              <textarea
                id={`${brainKey}-${key}`}
                rows={WIDE_KEYS.has(key) ? 4 : 2}
                value={data[brainKey][key] ?? ""}
                onChange={(e) =>
                  setData({ ...data, [brainKey]: { ...data[brainKey], [key]: e.target.value } })
                }
                placeholder={t(`settings.placeholders.${key}`)}
                className="w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("settings.title")}</h1>
          <p className="mt-1.5 text-sm text-wine-soft/70">{t("settings.subtitle")}</p>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="shrink-0 cursor-pointer rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:shadow-petal-lg hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
        >
          {saved ? `${t("common.saved")} ✓` : busy ? t("common.saving") : t("common.saveAll")}
        </button>
      </div>

      {gcalBanner && (
        <div
          className={`mb-6 flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-sm shadow-petal ${
            gcalBanner.type === "connected"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {gcalBanner.type === "connected" ? <IconCheckCircle size={16} /> : <IconAlert size={16} />}
          {gcalBanner.type === "connected"
            ? t("settings.googleCalendarConnectedBanner")
            : gcalBanner.message || t("settings.googleCalendarErrorBanner")}
        </div>
      )}

      <div className="space-y-6">
        {renderSection("brandBrain", BRAND_KEYS)}
        {renderSection("salesBrain", SALES_KEYS)}
        {renderSection("bookingBrain", BOOKING_KEYS)}

        <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-emerald-600"><IconChat size={15} /></span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t("settings.whatsapp")}</h2>
          </div>
          <p className="mb-5 text-xs text-wine-soft/50">{t("settings.whatsappDesc")}</p>
          <div>
            <label htmlFor="whatsappPhoneId" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
              {t("settings.fields.whatsappPhoneId")}
            </label>
            <input
              id="whatsappPhoneId"
              value={data.whatsappPhoneId}
              onChange={(e) => setData({ ...data, whatsappPhoneId: e.target.value })}
              placeholder={t("settings.placeholders.whatsappPhoneId")}
              className="w-full max-w-md rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-rose-500"><IconCalendar size={15} /></span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t("settings.googleCalendar")}</h2>
          </div>
          <p className="mb-5 text-xs text-wine-soft/50">{t("settings.googleCalendarDesc")}</p>
          {!gcal ? (
            <p className="text-sm text-wine-soft/50">{t("common.loading")}</p>
          ) : gcal.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <IconCheckCircle size={14} />
                {t("settings.googleCalendarConnectedAs")} {gcal.accountEmail}
              </span>
              <button
                onClick={disconnectGoogleCalendar}
                disabled={gcalBusy}
                className="cursor-pointer rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-wine-soft transition-colors duration-150 hover:bg-rose-50 disabled:opacity-50"
              >
                {t("settings.googleCalendarDisconnect")}
              </button>
            </div>
          ) : (
            <a
              href="/api/google-calendar/connect"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:shadow-petal-lg hover:brightness-105 active:scale-[0.99]"
            >
              <IconCalendar size={15} /> {t("settings.googleCalendarConnect")}
            </a>
          )}
        </section>

        <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-gold"><IconCalendar size={15} /></span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t("settings.maxBookingsPerDay")}</h2>
          </div>
          <p className="mb-5 text-xs text-wine-soft/50">{t("settings.maxBookingsPerDayDesc")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="maxBookingsPerDay" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
                {t("settings.fields.maxBookingsPerDay")}
              </label>
              <input
                id="maxBookingsPerDay"
                type="number"
                min={1}
                value={data.maxBookingsPerDay ?? ""}
                onChange={(e) =>
                  setData({ ...data, maxBookingsPerDay: e.target.value === "" ? null : Number(e.target.value) })
                }
                placeholder={t("settings.placeholders.maxBookingsPerDay")}
                className="w-full max-w-[10rem] rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
              {data.maxBookingsPerDay == null && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-600">
                  <IconAlert size={13} className="mt-0.5 shrink-0" />
                  {t("settings.maxBookingsPerDayHint")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="sessionDurationMinutes" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
                {t("settings.fields.sessionDurationMinutes")}
              </label>
              <input
                id="sessionDurationMinutes"
                type="number"
                min={15}
                step={15}
                value={data.sessionDurationMinutes ?? ""}
                onChange={(e) =>
                  setData({ ...data, sessionDurationMinutes: e.target.value === "" ? null : Number(e.target.value) })
                }
                placeholder={t("settings.placeholders.sessionDurationMinutes")}
                className="w-full max-w-[10rem] rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
              <p className="mt-2 text-xs text-wine-soft/50">{t("settings.sessionDurationHint")}</p>
            </div>
            <div>
              <label htmlFor="workingHoursStart" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
                {t("settings.fields.workingHoursStart")}
              </label>
              <input
                id="workingHoursStart"
                type="time"
                value={data.workingHoursStart ?? ""}
                onChange={(e) => setData({ ...data, workingHoursStart: e.target.value || null })}
                className="w-full max-w-[10rem] rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
            </div>
            <div>
              <label htmlFor="workingHoursEnd" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
                {t("settings.fields.workingHoursEnd")}
              </label>
              <input
                id="workingHoursEnd"
                type="time"
                value={data.workingHoursEnd ?? ""}
                onChange={(e) => setData({ ...data, workingHoursEnd: e.target.value || null })}
                className="w-full max-w-[10rem] rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
            </div>
            <div>
              <label htmlFor="bufferMinutes" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
                {t("settings.fields.bufferMinutes")}
              </label>
              <input
                id="bufferMinutes"
                type="number"
                min={0}
                step={15}
                value={data.bufferMinutes ?? ""}
                onChange={(e) => setData({ ...data, bufferMinutes: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder={t("settings.placeholders.bufferMinutes")}
                className="w-full max-w-[10rem] rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
              <p className="mt-2 text-xs text-wine-soft/50">{t("settings.bufferMinutesHint")}</p>
            </div>
            <div>
              <label htmlFor="minAdvanceNoticeHours" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
                {t("settings.fields.minAdvanceNoticeHours")}
              </label>
              <input
                id="minAdvanceNoticeHours"
                type="number"
                min={0}
                step={1}
                value={data.minAdvanceNoticeHours ?? ""}
                onChange={(e) =>
                  setData({ ...data, minAdvanceNoticeHours: e.target.value === "" ? null : Number(e.target.value) })
                }
                placeholder={t("settings.placeholders.minAdvanceNoticeHours")}
                className="w-full max-w-[10rem] rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
              />
              <p className="mt-2 text-xs text-wine-soft/50">{t("settings.minAdvanceNoticeHint")}</p>
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-semibold text-wine-soft/60">{t("settings.fields.workingDays")}</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const selectedDays = data.workingDays ? data.workingDays.split(",") : null;
                const isOn = selectedDays === null || selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const current = selectedDays ?? [...WEEKDAYS];
                      const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
                      // All 7 selected is equivalent to "no restriction" — store as null.
                      setData({ ...data, workingDays: next.length === WEEKDAYS.length ? null : next.join(",") });
                    }}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                      isOn
                        ? "border-rose-300 bg-rose-100 text-rose-700"
                        : "border-rose-100 bg-white text-wine-soft/40 hover:bg-rose-50"
                    }`}
                  >
                    {t(`settings.weekday.${day}`)}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-wine-soft/50">{t("settings.workingDaysHint")}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-champagne p-6 shadow-petal">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-gold"><IconAlert size={15} /></span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-amber-900">{t("settings.autoConfirmPayments")}</h2>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-amber-900/70">{t("settings.autoConfirmPaymentsDesc")}</p>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-amber-900">
            <input
              type="checkbox"
              checked={data.autoConfirmPayments}
              onChange={(e) => setData({ ...data, autoConfirmPayments: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-rose-600"
            />
            {t("settings.autoConfirmPaymentsToggle")}
          </label>
        </section>

        <section className="rounded-3xl border border-red-200 bg-red-50/40 p-6 shadow-petal">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-red-700">{t("settings.dangerZone")}</h2>
          <p className="mb-4 mt-1.5 text-xs leading-relaxed text-red-700/70">{t("settings.restartInterviewDesc")}</p>
          <button
            onClick={restartInterview}
            disabled={restarting}
            className="cursor-pointer rounded-full border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition-colors duration-150 hover:bg-red-50 disabled:opacity-50"
          >
            {restarting ? t("settings.restarted") : t("settings.restartInterview")}
          </button>
        </section>
      </div>
    </div>
  );
}
