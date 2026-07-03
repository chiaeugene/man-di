import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NavLinks } from "@/components/NavLinks";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { IconHeartFilled, IconLogout } from "@/components/Icons";
import { getServerT } from "@/lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const profile = await prisma.photographerProfile.findUnique({ where: { userId } });
  if (!profile) redirect("/login");

  const { t } = await getServerT();

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 z-40 flex w-60 flex-col overflow-hidden bg-gradient-to-b from-[#4a0d29] via-[#3b0a21] to-[#2a0718] text-white">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex items-center justify-between gap-2 px-6 pb-6 pt-7">
          <Link href="/dashboard" className="flex items-center gap-2.5 cursor-pointer">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-petal">
              <IconHeartFilled size={16} />
            </span>
            <span>
              <span className="block text-lg font-bold leading-tight tracking-tight">{t("nav.brandName")}</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-amber-300/90">
                {t("nav.tagline")}
              </span>
            </span>
          </Link>
        </div>

        <div className="relative mx-6 mb-5 flex justify-center">
          <LanguageSwitcher variant="dark" />
        </div>

        <div className="relative mx-6 mb-5 border-t border-white/10" />

        <div className="relative flex-1 overflow-y-auto pb-4">
          <NavLinks onboardingStatus={profile.onboardingStatus} />
        </div>

        <div className="relative border-t border-white/10 p-4">
          <p className="mb-3 truncate px-2 text-xs text-rose-100/50">
            {profile.studioName || session?.user?.name || "Your studio"}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs font-medium text-rose-100/70 transition-colors duration-200 hover:bg-white/5 hover:text-white">
              <IconLogout size={14} />
              {t("common.logOut")}
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-60 min-w-0 flex-1 p-8 lg:p-10">{children}</main>
    </div>
  );
}
