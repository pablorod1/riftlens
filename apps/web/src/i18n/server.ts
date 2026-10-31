import { lang } from "next/root-params";
import { defaultLocale, isLocale, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/es";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en").then((m) => m.default),
  es: () => import("./dictionaries/es").then((m) => m.default),
};

/** Idioma de la petición actual (segmento /[lang]), solo en Server Components. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : defaultLocale;
}

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  return dictionaries[locale ?? (await getLocale())]();
}

/** Para Server Actions, donde no hay root params: el idioma llega en el formulario. */
export function getDictionaryFor(value: unknown): Promise<Dictionary> {
  const locale = typeof value === "string" && isLocale(value) ? value : defaultLocale;
  return dictionaries[locale]();
}

export type { Dictionary, Locale };
