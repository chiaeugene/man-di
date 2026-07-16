"use client";

import { useEffect, useState } from "react";
import { IconMegaphone, IconSend, IconTrash, IconAlert } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { LEAD_STATUSES, LEAD_SOURCES, FOLLOWUP_EXCLUDED_STATUSES } from "@/lib/constants";
import { CHANNEL_LABEL_KEYS } from "@/lib/channels";

// Closed-out / human-handled leads are never valid broadcast targets
// (enforced again server-side in resolveAudience) — don't offer them.
const SELECTABLE_STATUSES = LEAD_STATUSES.filter(
  (s) => !FOLLOWUP_EXCLUDED_STATUSES.includes(s)
);

interface CampaignData {
  id: string;
  name: string;
  message: string;
  audience: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
}

export default function CampaignsPage() {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<CampaignData[] | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  function load() {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []));
  }

  useEffect(() => {
    load();
  }, []);

  async function createCampaign() {
    if (!name.trim() || !message.trim()) return;
    setCreating(true);
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, audience: { statuses, sources } }),
    });
    setCreating(false);
    setName("");
    setMessage("");
    setStatuses([]);
    setSources([]);
    load();
  }

  async function sendCampaign(id: string) {
    if (!confirm(t("campaigns.sendConfirm"))) return;
    setSendingId(id);
    await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
    setSendingId(null);
    load();
  }

  async function deleteCampaign(id: string) {
    if (!confirm(t("campaigns.deleteConfirm"))) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    load();
  }

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <p className="eyebrow">{t("campaigns.eyebrow")}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("campaigns.title")}</h1>
      <p className="mb-6 mt-1.5 text-sm text-wine-soft/70">{t("campaigns.subtitle")}</p>

      <section className="mb-8 rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-gold"><IconMegaphone size={15} /></span>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t("campaigns.newCampaign")}</h2>
        </div>
        <p className="mb-5 text-xs text-wine-soft/50">{t("campaigns.newCampaignDesc")}</p>

        <div className="grid gap-4">
          <div>
            <label htmlFor="campaignName" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
              {t("campaigns.fields.name")}
            </label>
            <input
              id="campaignName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("campaigns.placeholders.name")}
              className="w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
            />
          </div>
          <div>
            <label htmlFor="campaignMessage" className="mb-1.5 block text-xs font-semibold text-wine-soft/60">
              {t("campaigns.fields.message")}
            </label>
            <textarea
              id="campaignMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("campaigns.placeholders.message")}
              rows={3}
              className="w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
            />
            <p className="mt-1.5 text-xs text-wine-soft/50">{t("campaigns.messageHint")}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-wine-soft/60">{t("campaigns.fields.statuses")}</label>
            <div className="flex flex-wrap gap-2">
              {SELECTABLE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(statuses, setStatuses, s)}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    statuses.includes(s)
                      ? "border-rose-300 bg-rose-100 text-rose-700"
                      : "border-rose-100 bg-white text-wine-soft/40 hover:bg-rose-50"
                  }`}
                >
                  {t(`leadStatus.${s}`)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-wine-soft/50">{t("campaigns.statusesHint")}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-wine-soft/60">{t("campaigns.fields.sources")}</label>
            <div className="flex flex-wrap gap-2">
              {LEAD_SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(sources, setSources, s)}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    sources.includes(s)
                      ? "border-rose-300 bg-rose-100 text-rose-700"
                      : "border-rose-100 bg-white text-wine-soft/40 hover:bg-rose-50"
                  }`}
                >
                  {t(CHANNEL_LABEL_KEYS[s])}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-wine-soft/50">{t("campaigns.sourcesHint")}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-champagne px-4 py-3 text-xs leading-relaxed text-amber-900/80">
            <IconAlert size={13} className="mb-1 inline-block" /> {t("campaigns.whatsappWindowWarning")}
          </div>
          <div>
            <button
              type="button"
              onClick={createCampaign}
              disabled={creating || !name.trim() || !message.trim()}
              className="cursor-pointer rounded-xl bg-wine px-5 py-2.5 text-sm font-semibold text-white shadow-petal transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? t("common.loading") : t("campaigns.createDraft")}
            </button>
          </div>
        </div>
      </section>

      {!campaigns ? (
        <p className="text-sm text-wine-soft/50">{t("common.loading")}</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-12 text-center shadow-petal">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500">
            <IconMegaphone size={22} />
          </span>
          <p className="text-sm text-wine-soft/70">{t("campaigns.noCampaigns")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-rose-100 bg-white shadow-petal">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rose-100 bg-rose-50/60 text-left text-[11px] uppercase tracking-[0.12em] text-wine-soft/60">
                <th className="px-5 py-3 font-semibold">{t("campaigns.tableName")}</th>
                <th className="px-5 py-3 font-semibold">{t("campaigns.tableStatus")}</th>
                <th className="px-5 py-3 font-semibold">{t("campaigns.tableRecipients")}</th>
                <th className="px-5 py-3 font-semibold">{t("campaigns.tableSent")}</th>
                <th className="px-5 py-3 font-semibold">{t("campaigns.tableFailed")}</th>
                <th className="px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50">
              {campaigns.map((c) => (
                <tr key={c.id} className="transition-colors duration-150 hover:bg-rose-50/40">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-wine">{c.name}</p>
                    <p className="max-w-xs truncate text-xs text-wine-soft/50">{c.message}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.status === "SENT"
                          ? "bg-emerald-100 text-emerald-700"
                          : c.status === "SENDING"
                            ? "bg-amber-100 text-amber-700"
                            : c.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {t(`campaigns.status.${c.status}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-wine-soft">{c.recipientCount}</td>
                  <td className="px-5 py-3.5 tabular-nums text-wine-soft">{c.sentCount}</td>
                  <td className="px-5 py-3.5 tabular-nums text-wine-soft">{c.failedCount}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {c.status === "DRAFT" && (
                        <>
                          <button
                            type="button"
                            onClick={() => sendCampaign(c.id)}
                            disabled={sendingId === c.id}
                            title={t("campaigns.send")}
                            className="cursor-pointer rounded-lg p-1.5 text-rose-600 transition-colors duration-150 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <IconSend size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCampaign(c.id)}
                            title={t("campaigns.delete")}
                            className="cursor-pointer rounded-lg p-1.5 text-wine-soft/50 transition-colors duration-150 hover:bg-rose-50 hover:text-red-600"
                          >
                            <IconTrash size={15} />
                          </button>
                        </>
                      )}
                    </div>
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
