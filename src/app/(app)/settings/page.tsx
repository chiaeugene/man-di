"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconHeart, IconSparkles, IconWallet } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Brain = Record<string, string>;

interface SettingsData {
  brandBrain: Brain;
  salesBrain: Brain;
  bookingBrain: Brain;
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

const SECTION_META: Record<string, { Icon: typeof IconHeart; color: string }> = {
  brandBrain: { Icon: IconHeart, color: "text-rose-500" },
  salesBrain: { Icon: IconSparkles, color: "text-gold" },
  bookingBrain: { Icon: IconWallet, color: "text-emerald-600" },
};

export default function SettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<SettingsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) =>
        setData({ brandBrain: d.brandBrain ?? {}, salesBrain: d.salesBrain ?? {}, bookingBrain: d.bookingBrain ?? {} })
      );
  }, []);

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
    brainKey: keyof SettingsData,
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
            <div key={key} className={key === "paymentInstructions" || key === "styleProfile" ? "sm:col-span-2" : ""}>
              <label htmlFor={`${brainKey}-${key}`} className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
                {t(`settings.fields.${key}`)}
              </label>
              <textarea
                id={`${brainKey}-${key}`}
                rows={key === "paymentInstructions" || key === "styleProfile" ? 4 : 2}
                value={data[brainKey][key] ?? ""}
                onChange={(e) =>
                  setData({ ...data, [brainKey]: { ...data[brainKey], [key]: e.target.value } })
                }
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

      <div className="space-y-6">
        {renderSection("brandBrain", BRAND_KEYS)}
        {renderSection("salesBrain", SALES_KEYS)}
        {renderSection("bookingBrain", BOOKING_KEYS)}

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
