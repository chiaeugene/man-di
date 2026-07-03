"use client";

import type { LeadStatus } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// Wedding-toned status colors: blush → violet → gold → green journey.
const COLORS: Record<LeadStatus, string> = {
  "New Lead": "bg-sky-50 text-sky-700 ring-sky-200",
  "Asking Price": "bg-cyan-50 text-cyan-700 ring-cyan-200",
  Qualifying: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Qualified: "bg-violet-50 text-violet-700 ring-violet-200",
  "Package Recommended": "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  "Waiting Decision": "bg-amber-50 text-amber-700 ring-amber-200",
  "Waiting Deposit": "bg-orange-50 text-orange-700 ring-orange-200",
  "Deposit Paid": "bg-lime-50 text-lime-700 ring-lime-200",
  Booked: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Lost: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  "Human Takeover Needed": "bg-rose-50 text-rose-700 ring-rose-200",
};

// `status` is always the canonical English value stored in the database and
// used by AI/status-transition logic — only the on-screen label is localized.
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const color = COLORS[status as LeadStatus] ?? "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${color}`}
    >
      {t(`leadStatus.${status}`)}
    </span>
  );
}
