"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const inputCls =
  "w-full rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm text-wine outline-none transition-shadow duration-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-100";

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Signup failed. Please try again.");
      setBusy(false);
      return;
    }

    // Auto-login, then straight into Mandy's onboarding interview.
    const login = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (login?.error) {
      router.push("/login");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-wine">{t("auth.createAccountTitle")}</h2>
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-wine-soft">
          {t("auth.yourName")}
        </label>
        <input
          id="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-wine-soft">
          {t("auth.email")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-wine-soft">
          {t("auth.password")} <span className="font-normal text-wine-soft/60">{t("auth.passwordMin")}</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full cursor-pointer rounded-full bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-sm font-semibold text-white shadow-petal transition-all duration-200 hover:shadow-petal-lg hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? t("auth.creating") : t("auth.signUpBtn")}
      </button>
      <p className="text-center text-sm text-wine-soft/70">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-semibold text-rose-600 hover:underline">
          {t("auth.logIn")}
        </Link>
      </p>
    </form>
  );
}
