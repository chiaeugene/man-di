"use client";

import { useEffect, useState } from "react";
import {
  IconBook,
  IconCheck,
  IconClock,
  IconImage,
  IconPackage,
  IconPlus,
  IconSparkles,
  IconVideo,
} from "@/components/Icons";
import { useI18n } from "@/lib/i18n/LocaleProvider";

interface Pkg {
  id: string;
  name: string;
  priceMyr: number;
  hours: number | null;
  editedPhotos: number | null;
  includesAlbum: boolean;
  includesVideo: boolean;
  deliverables: string[];
  addOns: { name: string; priceMyr: number }[];
  description: string | null;
  isActive: boolean;
}

interface Rules {
  travelFeeRules: string;
  overtimeFeeRules: string;
}

const EMPTY_FORM = {
  name: "",
  priceMyr: "",
  hours: "",
  editedPhotos: "",
  includesAlbum: false,
  includesVideo: false,
  deliverables: "",
  addOns: "",
  description: "",
};

const inputCls =
  "w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100";
const labelCls = "mb-1.5 block text-xs font-semibold text-wine-soft/60";

export default function PackagesPage() {
  const { t } = useI18n();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [rules, setRules] = useState<Rules>({ travelFeeRules: "", overtimeFeeRules: "" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  useEffect(() => {
    fetch("/api/packages").then((r) => r.json()).then((d) => setPackages(d.packages ?? []));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) =>
        setRules({
          travelFeeRules: d.packageRules?.travelFeeRules ?? "",
          overtimeFeeRules: d.packageRules?.overtimeFeeRules ?? "",
        })
      );
  }, []);

  function startEdit(p: Pkg) {
    setEditingId(p.id);
    setShowForm(true);
    setForm({
      name: p.name,
      priceMyr: String(p.priceMyr),
      hours: p.hours != null ? String(p.hours) : "",
      editedPhotos: p.editedPhotos != null ? String(p.editedPhotos) : "",
      includesAlbum: p.includesAlbum,
      includesVideo: p.includesVideo,
      deliverables: p.deliverables.join("\n"),
      addOns: p.addOns.map((a) => `${a.name} | ${a.priceMyr}`).join("\n"),
      description: p.description ?? "",
    });
  }

  function parseAddOns(text: string) {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name, price] = l.split("|").map((s) => s.trim());
        return { name: name ?? l, priceMyr: Number(price) || 0 };
      });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      priceMyr: Number(form.priceMyr) || 0,
      hours: form.hours ? Number(form.hours) : null,
      editedPhotos: form.editedPhotos ? Number(form.editedPhotos) : null,
      includesAlbum: form.includesAlbum,
      includesVideo: form.includesVideo,
      deliverables: form.deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
      addOns: parseAddOns(form.addOns),
      description: form.description.trim() || null,
    };
    const res = await fetch(editingId ? `/api/packages/${editingId}` : "/api/packages", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed.");
      return;
    }
    setPackages((ps) =>
      editingId ? ps.map((p) => (p.id === editingId ? data.package : p)) : [...ps, data.package]
    );
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  async function remove(id: string) {
    if (!confirm(t("packages.deleteConfirm"))) return;
    const res = await fetch(`/api/packages/${id}`, { method: "DELETE" });
    if (res.ok) setPackages((ps) => ps.filter((p) => p.id !== id));
  }

  async function saveRules() {
    setBusy(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageRules: rules }),
    });
    setBusy(false);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("packages.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">{t("packages.title")}</h1>
          <p className="mt-1.5 text-sm text-wine-soft/70">{t("packages.subtitle")}</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(EMPTY_FORM);
          }}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:shadow-petal-lg hover:brightness-105 active:scale-[0.99]"
        >
          <IconPlus size={15} /> {t("packages.addPackage")}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={save}
          className="mb-7 space-y-4 rounded-3xl border border-rose-200 bg-white p-6 shadow-petal-lg animate-bloom"
        >
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">
            {editingId ? t("packages.editPackage") : t("packages.newPackage")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("packages.name")}</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder={t("packages.namePlaceholder")} />
            </div>
            <div>
              <label className={labelCls}>{t("packages.price")}</label>
              <input required type="number" min={0} value={form.priceMyr} onChange={(e) => setForm({ ...form, priceMyr: e.target.value })} className={inputCls} placeholder="3999" />
            </div>
            <div>
              <label className={labelCls}>{t("packages.hours")}</label>
              <input type="number" min={0} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} className={inputCls} placeholder="10" />
            </div>
            <div>
              <label className={labelCls}>{t("packages.editedPhotos")}</label>
              <input type="number" min={0} value={form.editedPhotos} onChange={(e) => setForm({ ...form, editedPhotos: e.target.value })} className={inputCls} placeholder="400" />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-wine">
              <input type="checkbox" checked={form.includesAlbum} onChange={(e) => setForm({ ...form, includesAlbum: e.target.checked })} className="accent-rose-600" />
              {t("packages.includesAlbum")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-wine">
              <input type="checkbox" checked={form.includesVideo} onChange={(e) => setForm({ ...form, includesVideo: e.target.checked })} className="accent-rose-600" />
              {t("packages.includesVideo")}
            </label>
          </div>
          <div>
            <label className={labelCls}>{t("packages.deliverables")}</label>
            <textarea rows={3} value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} className={inputCls} placeholder={t("packages.deliverablesPlaceholder")} />
          </div>
          <div>
            <label className={labelCls}>{t("packages.addOns")}</label>
            <textarea rows={2} value={form.addOns} onChange={(e) => setForm({ ...form, addOns: e.target.value })} className={inputCls} placeholder={t("packages.addOnsPlaceholder")} />
          </div>
          <div>
            <label className={labelCls}>{t("packages.notes")}</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder={t("packages.notesPlaceholder")} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2.5">
            <button type="submit" disabled={busy} className="cursor-pointer rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:brightness-105 disabled:opacity-50">
              {editingId ? t("packages.saveChanges") : t("packages.addPackage")}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="cursor-pointer rounded-full border border-rose-200 px-5 py-2.5 text-sm font-medium text-wine-soft transition-colors duration-150 hover:bg-rose-50">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {packages.length === 0 && !showForm ? (
        <div className="rounded-3xl border border-dashed border-rose-200 bg-white/70 p-12 text-center shadow-petal">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500">
            <IconPackage size={22} />
          </span>
          <p className="text-sm text-wine-soft/70">{t("packages.noPackagesTitle")}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {packages.map((p) => (
            <div
              key={p.id}
              className="group relative overflow-hidden rounded-3xl border border-rose-100 bg-white p-6 shadow-petal transition-all duration-200 hover:-translate-y-0.5 hover:shadow-petal-lg"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-rose-100/60 blur-2xl transition-opacity duration-200 group-hover:opacity-100" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-wine">{p.name}</h3>
                  <p className="mt-0.5 text-2xl font-bold tracking-tight text-rose-600">
                    <span className="text-sm font-semibold text-gold">RM</span>
                    {p.priceMyr.toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-3 text-xs font-medium">
                  <button onClick={() => startEdit(p)} className="cursor-pointer text-wine-soft/60 transition-colors duration-150 hover:text-rose-600">{t("common.edit")}</button>
                  <button onClick={() => remove(p.id)} className="cursor-pointer text-wine-soft/40 transition-colors duration-150 hover:text-red-600">{t("common.delete")}</button>
                </div>
              </div>
              <ul className="relative mt-4 space-y-2 text-sm text-wine-soft">
                {p.hours != null && (
                  <li className="flex items-center gap-2">
                    <span className="text-rose-400"><IconClock size={14} /></span>
                    {p.hours} {t("packages.hoursCoverage")}
                  </li>
                )}
                {p.editedPhotos != null && (
                  <li className="flex items-center gap-2">
                    <span className="text-rose-400"><IconImage size={14} /></span>
                    {p.editedPhotos} {t("packages.editedPhotosLabel")}
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <span className={p.includesAlbum ? "text-rose-400" : "text-rose-200"}><IconBook size={14} /></span>
                  {p.includesAlbum ? t("packages.albumIncluded") : t("packages.albumNotIncluded")}
                </li>
                <li className="flex items-center gap-2">
                  <span className={p.includesVideo ? "text-rose-400" : "text-rose-200"}><IconVideo size={14} /></span>
                  {p.includesVideo ? t("packages.videoIncluded") : t("packages.videoNotIncluded")}
                </li>
                {p.deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 text-emerald-500"><IconCheck size={12} /></span>
                    {d}
                  </li>
                ))}
              </ul>
              {p.addOns.length > 0 && (
                <p className="relative mt-4 border-t border-rose-50 pt-3 text-xs text-wine-soft/50">
                  <span className="font-semibold text-gold">{t("packages.addOnsLabel")}</span>{" "}
                  {p.addOns.map((a) => `${a.name} (RM${a.priceMyr})`).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="mt-9 rounded-3xl border border-rose-100 bg-white p-6 shadow-petal">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-gold"><IconSparkles size={15} /></span>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-wine-soft">{t("packages.globalFeeRules")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t("packages.travelFeeRules")}</label>
            <textarea rows={3} value={rules.travelFeeRules} onChange={(e) => setRules({ ...rules, travelFeeRules: e.target.value })} className={inputCls} placeholder={t("packages.travelFeeRulesPlaceholder")} />
          </div>
          <div>
            <label className={labelCls}>{t("packages.overtimeFeeRules")}</label>
            <textarea rows={3} value={rules.overtimeFeeRules} onChange={(e) => setRules({ ...rules, overtimeFeeRules: e.target.value })} className={inputCls} placeholder={t("packages.overtimeFeeRulesPlaceholder")} />
          </div>
        </div>
        <button
          onClick={saveRules}
          disabled={busy}
          className="mt-4 cursor-pointer rounded-full bg-wine px-5 py-2.5 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:brightness-125 disabled:opacity-50"
        >
          {rulesSaved ? `${t("common.saved")} ✓` : t("packages.saveFeeRules")}
        </button>
      </section>
    </div>
  );
}
