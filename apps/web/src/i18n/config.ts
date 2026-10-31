/** Idiomas soportados. Para añadir uno: diccionario en ./dictionaries y entrada aquí. */
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];

/** Idioma si el navegador no pide ninguno de los soportados. */
export const defaultLocale: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (value: string | undefined): value is Locale =>
  !!value && (locales as readonly string[]).includes(value);

export const localeNames: Record<Locale, string> = { en: "English", es: "Español" };

/** Locale de Intl (fechas, números) */
export const intlLocale: Record<Locale, string> = { en: "en-GB", es: "es-ES" };

/** Idioma de Data Dragon para nombres de campeones, objetos y runas */
export const ddragonLocale: Record<Locale, string> = { en: "en_US", es: "es_ES" };

/** Prefija una ruta interna con el idioma: ("es", "/rankings/euw") -> "/es/rankings/euw" */
export const localePath = (locale: Locale, path: string) => `/${locale}${path === "/" ? "" : path}`;

/** Sustituye {variables} en un texto del diccionario. */
export function t(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
