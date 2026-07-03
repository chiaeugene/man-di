import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadActions } from "@/components/LeadActions";
import { getServerT } from "@/lib/i18n/server";
import {
  IconAlert,
  IconArrowLeft,
  IconCalendar,
  IconHeartFilled,
  IconSparkles,
} from "@/components/Icons";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const { t } = await getServerT();

  const lead = await prisma.lead.findFirst({
    where: { id, profileId: profile.id },
    include: {
      conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!lead) notFound();

  const messages = lead.conversation?.messages ?? [];

  const facts: [string, string | null][] = [
    [t("leadDetail.phone"), lead.phone],
    [t("leadDetail.weddingDate"), lead.eventDate],
    [t("leadDetail.location"), lead.location],
    [t("leadDetail.eventType"), lead.eventType],
    [t("leadDetail.budgetRange"), lead.budgetRange],
    [t("leadDetail.source"), lead.source === "PLAYGROUND" ? t("leadDetail.testSource") : t("leadDetail.whatsappSource")],
    [t("leadDetail.deposit"), lead.depositStatus.replaceAll("_", " ").toLowerCase()],
    [t("leadDetail.calendar"), lead.calendarStatus === "CREATED" ? t("leadDetail.eventCreated") : "—"],
  ];

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <Link
        href="/leads"
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-wine-soft/60 transition-colors duration-150 hover:text-rose-600"
      >
        <IconArrowLeft size={15} /> {t("leadDetail.allLeads")}
      </Link>
      <div className="mb-7 mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-wine">
          {lead.customerName || t("leadDetail.newInquiry")}
        </h1>
        <StatusBadge status={lead.status} />
        {lead.needsHuman && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">
            <IconAlert size={12} />
            {t("leadDetail.needsYou")}
            {lead.takeoverReason ? `: ${lead.takeoverReason}` : ""}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-petal">
          <h2 className="border-b border-rose-100 bg-rose-50/50 px-6 py-4 text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">
            {t("leadDetail.conversation")}
          </h2>
          <div className="chat-texture max-h-[32rem] space-y-4 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <p className="text-sm text-wine-soft/50">{t("leadDetail.noMessages")}</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex items-start gap-2.5 ${m.role === "CUSTOMER" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[75%] whitespace-pre-wrap rounded-3xl px-4.5 py-3 text-sm leading-relaxed ${
                      m.role === "CUSTOMER"
                        ? "rounded-tl-lg border border-rose-100/80 bg-white text-wine shadow-petal"
                        : m.role === "MANDY"
                          ? "rounded-br-lg bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-petal"
                          : "rounded-br-lg bg-wine text-white shadow-petal"
                    }`}
                  >
                    <div
                      className={`mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        m.role === "CUSTOMER" ? "text-gold" : "text-white/70"
                      }`}
                    >
                      {m.role === "MANDY" && <IconHeartFilled size={9} />}
                      {m.role === "CUSTOMER" ? t("leadDetail.customer") : m.role === "MANDY" ? t("leadDetail.mandy") : t("leadDetail.you")}
                      <span className="font-normal normal-case tracking-normal opacity-70">
                        {new Date(m.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {m.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-gold"><IconCalendar size={15} /></span>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t("leadDetail.leadProfile")}</h2>
            </div>
            <dl className="space-y-2.5 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-wine-soft/50">{k}</dt>
                  <dd className="text-right font-semibold text-wine">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {lead.summary && (
              <div className="mt-4 border-t border-rose-50 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-wine-soft/50">
                  {t("leadDetail.conversationSummary")}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-wine-soft">{lead.summary}</p>
              </div>
            )}
            {lead.nextAction && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200/70 bg-champagne p-3.5">
                <span className="mt-0.5 text-gold"><IconSparkles size={13} /></span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                    {t("leadDetail.nextAction")}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-amber-900">{lead.nextAction}</p>
                </div>
              </div>
            )}
          </section>

          <LeadActions
            leadId={lead.id}
            status={lead.status}
            depositStatus={lead.depositStatus}
            needsHuman={lead.needsHuman}
          />
        </div>
      </div>
    </div>
  );
}
