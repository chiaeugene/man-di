import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { getDictionary, translate } from "./dictionaries";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

// Convenience for server components/route handlers: `const t = await getServerT();`
export async function getServerT() {
  const locale = await getServerLocale();
  const dict = getDictionary(locale);
  return {
    locale,
    t: (path: string, vars?: Record<string, string | number>) => translate(dict, path, vars),
  };
}
