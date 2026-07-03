"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconChat,
  IconSparkles,
  IconPackage,
  IconFlask,
  IconUsers,
  IconSettings,
} from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const LINKS = [
  { href: "/dashboard", key: "nav.dashboard", Icon: IconDashboard },
  { href: "/onboarding", key: "nav.onboarding", Icon: IconChat },
  { href: "/training", key: "nav.training", Icon: IconSparkles },
  { href: "/packages", key: "nav.packages", Icon: IconPackage },
  { href: "/playground", key: "nav.playground", Icon: IconFlask },
  { href: "/leads", key: "nav.leads", Icon: IconUsers },
  { href: "/settings", key: "nav.settings", Icon: IconSettings },
];

export function NavLinks({ onboardingStatus }: { onboardingStatus: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {LINKS.map(({ href, key, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const showDot =
          (href === "/onboarding" && onboardingStatus !== "COMPLETED" && onboardingStatus !== "TRAINING") ||
          (href === "/training" && onboardingStatus === "TRAINING");
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
              active
                ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                : "text-rose-100/60 hover:bg-white/5 hover:text-rose-50"
            }`}
          >
            <span
              className={`transition-colors duration-200 ${
                active ? "text-amber-300" : "text-rose-200/50 group-hover:text-rose-100"
              }`}
            >
              <Icon size={17} />
            </span>
            {t(key)}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-300" />}
            {!active && showDot && (
              <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-rose-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
