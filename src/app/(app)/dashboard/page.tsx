import Link from "next/link";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { LEAD_SOURCES } from "@/lib/constants";
import { getServerT } from "@/lib/i18n/server";
import { listUpcomingCalendarEvents } from "@/lib/google-calendar/events";
import {
  IconAlert,
  IconArrowRight,
  IconCalendar,
  IconCamera,
  IconCheckCircle,
  IconHeart,
  IconRings,
  IconSparkles,
  IconUsers,
  IconWallet,
  IconChat,
} from "@/components/Icons";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const { t } = await getServerT();

  const [leads, recentConversations] = await Promise.all([
    prisma.lead.findMany({ where: { profileId: profile.id }, orderBy: { updatedAt: "desc" } }),
    prisma.conversation.findMany({
      where: { profileId: profile.id, kind: { in: [...LEAD_SOURCES] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        lead: true,
        messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
      },
    }),
  ]);

  const byStatus = new Map<string, number>();
  for (const l of leads) byStatus.set(l.status, (byStatus.get(l.status) ?? 0) + 1);

  const takeoverCount = leads.filter((l) => l.needsHuman).length;
  const bookedLeads = leads.filter((l) => l.status === "Booked");
  const setupIncomplete = profile.onboardingStatus !== "COMPLETED";
  const firstName = (profile.photographerName || "").split(" ")[0];

  // "Upcoming Weddings" reflects the real connected Google Calendar (source of
  // truth) rather than only Mandy's own booked leads — a photographer may add
  // events directly in Google Calendar too. `null` means the calendar
  // couldn't be checked at all (not connected, or a transient API error) —
  // falls back to the internal booked-leads list in that case, so the
  // section is never blank just because a single live read failed.
  const liveCalendarEvents = profile.googleCalendarConnected
    ? await listUpcomingCalendarEvents(profile, 10)
    : null;
  const calendarEvents = liveCalendarEvents ?? [];
  const usingLiveCalendar = liveCalendarEvents !== null;
  const eventIds = calendarEvents.map((e) => e.id);
  const leadsByEventId = eventIds.length
    ? new Map(
        (
          await prisma.lead.findMany({ where: { profileId: profile.id, googleEventId: { in: eventIds } } })
        ).map((l) => [l.googleEventId as string, l])
      )
    : new Map<string, (typeof leads)[number]>();

  const cards = [
    { label: t("dashboard.totalLeads"), value: leads.length, href: "/leads", Icon: IconUsers, tint: "from-rose-100 to-pink-50 text-rose-600" },
    { label: t("dashboard.newLeads"), value: byStatus.get("New Lead") ?? 0, href: "/leads?status=New Lead", Icon: IconSparkles, tint: "from-sky-100 to-cyan-50 text-sky-600" },
    { label: t("dashboard.qualified"), value: byStatus.get("Qualified") ?? 0, href: "/leads?status=Qualified", Icon: IconHeart, tint: "from-violet-100 to-purple-50 text-violet-600" },
    { label: t("dashboard.waitingDeposit"), value: byStatus.get("Waiting Deposit") ?? 0, href: "/leads?status=Waiting Deposit", Icon: IconWallet, tint: "from-amber-100 to-yellow-50 text-amber-600" },
    { label: t("dashboard.booked"), value: byStatus.get("Booked") ?? 0, href: "/leads?status=Booked", Icon: IconRings, tint: "from-emerald-100 to-teal-50 text-emerald-600" },
    { label: t("dashboard.lost"), value: byStatus.get("Lost") ?? 0, href: "/leads?status=Lost", Icon: IconCamera, tint: "from-zinc-100 to-zinc-50 text-zinc-500" },
  ];

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <p className="eyebrow">{profile.studioName || t("dashboard.eyebrow")}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">
        {firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.greetingNoName")}
      </h1>
      <p className="mb-8 mt-1.5 text-sm text-wine-soft/70">{t("dashboard.subtitle")}</p>

      {setupIncomplete && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-champagne p-5 text-sm text-amber-900 shadow-petal">
          <span className="mt-0.5 text-gold">
            <IconSparkles size={18} />
          </span>
          <p>
            <span className="font-semibold">{t("dashboard.finishSetupPrefix")}</span>{" "}
            {profile.onboardingStatus === "TRAINING" ? (
              <>
                {t("dashboard.finishSetupTraining")}{" "}
                <Link href="/packages" className="font-semibold text-rose-700 underline underline-offset-2">
                  {t("dashboard.addPackages")}
                </Link>{" "}
                {t("dashboard.and")}{" "}
                <Link href="/training" className="font-semibold text-rose-700 underline underline-offset-2">
                  {t("dashboard.runRolePlays")}
                </Link>{" "}
                {t("dashboard.soSheSells")}
              </>
            ) : (
              <>
                {t("dashboard.startInterview")}{" "}
                <Link href="/onboarding" className="font-semibold text-rose-700 underline underline-offset-2">
                  {t("dashboard.setupInterview")}
                </Link>{" "}
                {t("dashboard.soMandyLearns")}
              </>
            )}
          </p>
        </div>
      )}

      {takeoverCount > 0 && (
        <Link
          href="/leads?status=Human Takeover Needed"
          className="group mb-6 flex cursor-pointer items-center gap-3 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 p-5 text-sm font-semibold text-white shadow-petal-lg transition-all duration-200 hover:brightness-105"
        >
          <IconAlert size={20} className="shrink-0" />
          <span>
            {takeoverCount === 1
              ? t("dashboard.takeoverAlertOne")
              : t("dashboard.takeoverAlertMany", { count: takeoverCount })}
          </span>
          <IconArrowRight size={18} className="ml-auto shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      )}

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(({ label, value, href, Icon, tint }) => (
          <Link
            key={label}
            href={href}
            className="group cursor-pointer rounded-2xl border border-rose-100 bg-white p-4 shadow-petal transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-petal-lg"
          >
            <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${tint}`}>
              <Icon size={17} />
            </span>
            <p className="text-2xl font-bold tabular-nums text-wine">{value}</p>
            <p className="mt-0.5 text-xs font-medium text-wine-soft/60">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-rose-500"><IconChat size={16} /></span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">
              {t("dashboard.latestConversations")}
            </h2>
          </div>
          {recentConversations.length === 0 ? (
            <p className="rounded-2xl bg-rose-50/60 p-5 text-center text-sm text-wine-soft/60">
              {t("dashboard.noConversations")}{" "}
              <Link href="/playground" className="font-semibold text-rose-600 underline underline-offset-2">
                {t("dashboard.playground")}
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-rose-50">
              {recentConversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={c.lead ? `/leads/${c.lead.id}` : "/leads"}
                    className="block cursor-pointer rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-rose-50/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold text-wine">
                        {c.lead?.customerName || t("dashboard.newInquiry")}
                        <ChannelBadge source={c.kind} />
                      </span>
                      {c.lead && <StatusBadge status={c.lead.status} />}
                    </div>
                    <p className="mt-1 truncate text-xs text-wine-soft/60">
                      {c.messages[0]?.content ?? "(no messages)"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-gold"><IconCalendar size={16} /></span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">
              {t("dashboard.upcomingWeddings")}
            </h2>
          </div>
          {usingLiveCalendar ? (
            calendarEvents.length === 0 ? (
              <p className="rounded-2xl bg-rose-50/60 p-5 text-center text-sm text-wine-soft/60">
                {t("dashboard.noBookings")}
              </p>
            ) : (
              <ul className="divide-y divide-rose-50">
                {calendarEvents.map((ev) => {
                  const lead = leadsByEventId.get(ev.id);
                  const Row = (
                    <>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600">
                        <IconRings size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-wine">
                          {lead?.customerName || ev.summary}
                        </p>
                        <p className="truncate text-xs text-wine-soft/60">
                          {ev.isoDate} · {ev.location || lead?.location || t("dashboard.locationTbc")}
                        </p>
                      </div>
                      {lead ? (
                        lead.depositStatus === "CONFIRMED" ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
                            <IconCheckCircle size={13} /> {t("dashboard.depositConfirmed")}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-medium text-amber-600">{t("dashboard.depositPending")}</span>
                        )
                      ) : (
                        <span className="shrink-0 text-[11px] font-medium text-wine-soft/40">{t("dashboard.fromGoogleCalendar")}</span>
                      )}
                    </>
                  );
                  return (
                    <li key={ev.id}>
                      {lead ? (
                        <Link
                          href={`/leads/${lead.id}`}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-rose-50/50"
                        >
                          {Row}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-3">{Row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : bookedLeads.length === 0 ? (
            <p className="rounded-2xl bg-rose-50/60 p-5 text-center text-sm text-wine-soft/60">
              {t("dashboard.noBookings")}
            </p>
          ) : (
            <ul className="divide-y divide-rose-50">
              {bookedLeads.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/leads/${l.id}`}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-rose-50/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-600">
                      <IconRings size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-wine">
                        {l.customerName || t("leadDetail.customer")}
                      </p>
                      <p className="truncate text-xs text-wine-soft/60">
                        {l.eventDate || t("dashboard.dateTbc")} · {l.location || t("dashboard.locationTbc")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {l.depositStatus === "CONFIRMED" ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <IconCheckCircle size={13} /> {t("dashboard.depositConfirmed")}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-600">{t("dashboard.depositPending")}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
