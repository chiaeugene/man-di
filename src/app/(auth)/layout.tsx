"use client";

import { IconHeartFilled, IconCamera, IconRings, IconSparkles } from "@/components/Icons";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden p-6">
      {/* romantic backdrop */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-rose-200/50 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute left-8 top-24 -rotate-12 text-rose-300/50">
          <IconRings size={72} strokeWidth={1.25} />
        </div>
        <div className="absolute bottom-20 left-24 rotate-6 text-amber-400/40">
          <IconSparkles size={44} strokeWidth={1.25} />
        </div>
        <div className="absolute right-14 top-32 rotate-12 text-rose-300/50">
          <IconCamera size={60} strokeWidth={1.25} />
        </div>
      </div>

      <div className="absolute right-6 top-6">
        <LanguageSwitcher variant="light" />
      </div>

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-petal-lg">
            <IconHeartFilled size={24} />
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-wine">Mandy</h1>
          <p className="eyebrow mt-2">{t("auth.heroTagline")}</p>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-wine-soft/70">
            {t("auth.heroSubtitle")}
          </p>
        </div>
        <div className="rounded-3xl border border-rose-100 bg-white/85 p-8 shadow-petal-lg backdrop-blur-sm">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-wine-soft/50">
          {t("auth.madeFor")} 🇲🇾
        </p>
      </div>
    </div>
  );
}
