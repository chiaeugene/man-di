"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STATUSES } from "@/lib/constants";
import { IconCheck, IconCheckCircle, IconHeart, IconSettings } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export function LeadActions({
  leadId,
  status,
  depositStatus,
  needsHuman,
}: {
  leadId: string;
  status: string;
  depositStatus: string;
  needsHuman: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed.");
      return;
    }
    router.refresh();
  }

  async function takeover(action: "take" | "release") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/leads/${leadId}/takeover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-rose-500"><IconSettings size={15} /></span>
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t("leadDetail.actions")}</h2>
      </div>

      <label htmlFor="lead-status" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
        {t("leadDetail.status")}
      </label>
      <select
        id="lead-status"
        value={status}
        disabled={busy}
        onChange={(e) => patch({ status: e.target.value })}
        className="mb-4 w-full cursor-pointer rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>{t(`leadStatus.${s}`)}</option>
        ))}
      </select>

      {depositStatus !== "CONFIRMED" ? (
        <button
          onClick={() => patch({ depositStatus: "CONFIRMED" })}
          disabled={busy}
          className="mb-2.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
        >
          <IconCheck size={15} />
          {t("leadDetail.confirmDeposit")}
        </button>
      ) : (
        <p className="mb-2.5 flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 py-2.5 text-center text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <IconCheckCircle size={15} /> {t("leadDetail.depositConfirmedLabel")}
        </p>
      )}

      {needsHuman ? (
        <button
          onClick={() => takeover("release")}
          disabled={busy}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-rose-200 py-2.5 text-sm font-semibold text-wine-soft transition-colors duration-200 hover:bg-rose-50 disabled:opacity-50"
        >
          <IconHeart size={15} />
          {t("leadDetail.handBack")}
        </button>
      ) : (
        <button
          onClick={() => takeover("take")}
          disabled={busy}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-rose-300 py-2.5 text-sm font-semibold text-rose-700 transition-colors duration-200 hover:bg-rose-50 disabled:opacity-50"
        >
          {t("leadDetail.takeOver")}
        </button>
      )}

      {error && <p className="mt-2.5 text-xs text-red-600">{error}</p>}
      <p className="mt-4 text-[11px] leading-relaxed text-wine-soft/50">{t("leadDetail.disclaimer")}</p>
    </section>
  );
}
