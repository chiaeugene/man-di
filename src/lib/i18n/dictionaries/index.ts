import en from "./en";
import zh from "./zh";
import ms from "./ms";
import type { Locale } from "../config";

export const dictionaries = { en, zh, ms };
export type Dictionary = typeof en;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

// Generic dot-path lookup with {{var}} interpolation, falling back to English
// (and finally the path itself) if a key is missing in the target locale.
export function translate(
  dict: Dictionary,
  path: string,
  vars?: Record<string, string | number>
): string {
  const lookup = (d: Record<string, unknown>): string | undefined => {
    let cur: unknown = d;
    for (const part of path.split(".")) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === "string" ? cur : undefined;
  };

  const raw = lookup(dict as unknown as Record<string, unknown>) ?? lookup(en as unknown as Record<string, unknown>) ?? path;

  if (!vars) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ""));
}
