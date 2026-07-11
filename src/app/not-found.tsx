import Link from "next/link";
import { IconHeartFilled, IconSparkles } from "@/components/Icons";
import { getServerT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getServerT();

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-zinc-50 p-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-rose-200/50 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute right-14 top-32 rotate-12 text-rose-300/50">
          <IconSparkles size={44} strokeWidth={1.25} />
        </div>
      </div>

      <div className="relative w-full max-w-md animate-fade-up text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-petal-lg">
          <IconHeartFilled size={24} />
        </span>
        <p className="eyebrow">{t("notFound.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-wine">{t("notFound.title")}</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-wine-soft/70">
          {t("notFound.subtitle")}
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block cursor-pointer rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:shadow-petal-lg hover:brightness-105 active:scale-[0.99]"
        >
          {t("notFound.backLink")}
        </Link>
      </div>
    </div>
  );
}
