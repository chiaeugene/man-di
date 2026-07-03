"use client";

import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// Compact segmented control: EN / 中文 / BM. Used in the app sidebar and on
// auth pages. Short labels keep it usable in the narrow sidebar footer.
const SHORT_LABELS: Record<string, string> = { en: "EN", zh: "中文", ms: "BM" };

export function LanguageSwitcher({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full p-0.5 text-xs font-semibold ${
        variant === "dark" ? "bg-white/5 ring-1 ring-white/10" : "bg-rose-50 ring-1 ring-rose-100"
      }`}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            title={LOCALE_LABELS[l]}
            aria-pressed={active}
            className={`cursor-pointer rounded-full px-2.5 py-1 transition-colors duration-150 ${
              active
                ? variant === "dark"
                  ? "bg-white/15 text-white"
                  : "bg-white text-rose-700 shadow-petal"
                : variant === "dark"
                  ? "text-rose-100/50 hover:text-rose-50"
                  : "text-wine-soft/50 hover:text-wine-soft"
            }`}
          >
            {SHORT_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
