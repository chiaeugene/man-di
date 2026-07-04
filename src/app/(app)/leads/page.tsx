import Link from "next/link";
import { requireProfile } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { ChannelBadge } from "@/components/ChannelBadge";
import { LEAD_STATUSES } from "@/lib/constants";
import { IconAlert, IconUsers } from "@/components/Icons";
import { getServerT } from "@/lib/i18n/server";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await requireProfile();
  const { t } = await getServerT();
  const { status } = await searchParams;
  const validStatus = status && (LEAD_STATUSES as readonly string[]).includes(status) ? status : null;

  const leads = await prisma.lead.findMany({
    where: { profileId: profile.id, ...(validStatus ? { status: validStatus } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <p className="eyebrow">{t("leads.eyebrow")}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("leads.title")}</h1>
      <p className="mb-6 mt-1.5 text-sm text-wine-soft/70">{t("leads.subtitle")}</p>

      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link
          href="/leads"
          className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
            !validStatus
              ? "bg-wine text-white shadow-petal"
              : "border border-rose-200 bg-white text-wine-soft hover:bg-rose-50"
          }`}
        >
          {t("leads.all")}
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/leads?status=${encodeURIComponent(s)}`}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              validStatus === s
                ? "bg-wine text-white shadow-petal"
                : "border border-rose-200 bg-white text-wine-soft hover:bg-rose-50"
            }`}
          >
            {t(`leadStatus.${s}`)}
          </Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-12 text-center shadow-petal">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500">
            <IconUsers size={22} />
          </span>
          <p className="text-sm text-wine-soft/70">
            {t("leads.noLeadsPrefix")}
            {validStatus ? ` ${t("leads.noLeadsWithStatus")} "${t(`leadStatus.${validStatus}`)}"` : ` ${t("leads.noLeadsYet")}`}
            . {t("leads.noLeadsSuffix")}{" "}
            <Link href="/playground" className="font-semibold text-rose-600 underline underline-offset-2">
              {t("leads.playground")}
            </Link>{" "}
            {t("leads.noLeadsSuffix2")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-rose-100 bg-white shadow-petal">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rose-100 bg-rose-50/60 text-left text-[11px] uppercase tracking-[0.12em] text-wine-soft/60">
                <th className="px-5 py-3 font-semibold">{t("leads.tableCouple")}</th>
                <th className="px-5 py-3 font-semibold">{t("leads.tableChannel")}</th>
                <th className="px-5 py-3 font-semibold">{t("leads.tableDate")}</th>
                <th className="px-5 py-3 font-semibold">{t("leads.tableLocation")}</th>
                <th className="px-5 py-3 font-semibold">{t("leads.tableStatus")}</th>
                <th className="px-5 py-3 font-semibold">{t("leads.tableDeposit")}</th>
                <th className="px-5 py-3 font-semibold">{t("leads.tableUpdated")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50">
              {leads.map((l) => (
                <tr key={l.id} className="transition-colors duration-150 hover:bg-rose-50/40">
                  <td className="px-5 py-3.5">
                    <Link href={`/leads/${l.id}`} className="cursor-pointer font-semibold text-wine hover:text-rose-600">
                      <span className="flex items-center gap-1.5">
                        {l.customerName || t("dashboard.newInquiry")}
                        {l.needsHuman && (
                          <span className="text-rose-500" title={l.takeoverReason ?? ""}>
                            <IconAlert size={13} />
                          </span>
                        )}
                      </span>
                    </Link>
                    {l.phone && <p className="text-xs text-wine-soft/50">{l.phone}</p>}
                  </td>
                  <td className="px-5 py-3.5"><ChannelBadge source={l.source} /></td>
                  <td className="px-5 py-3.5 tabular-nums text-wine-soft">{l.eventDate || "—"}</td>
                  <td className="px-5 py-3.5 text-wine-soft">{l.location || "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={l.status} /></td>
                  <td className="px-5 py-3.5 text-xs capitalize text-wine-soft">
                    {l.depositStatus.replaceAll("_", " ").toLowerCase()}
                  </td>
                  <td className="px-5 py-3.5 text-xs tabular-nums text-wine-soft/50">
                    {new Date(l.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
