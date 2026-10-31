import { intlLocale, localePath, type Locale } from "@/i18n/config";

/** URL del perfil: /es/summoner/euw/Nombre-TAG (como op.gg). */
export function summonerPath(locale: Locale, regionSlug: string, gameName: string, tagLine: string) {
  return localePath(locale, `/summoner/${regionSlug}/${encodeURIComponent(`${gameName}-${tagLine}`)}`);
}

/** "Nombre con espacios-TAG" -> { gameName, tagLine }. El tag nunca lleva guiones. */
export function parseRiotIdSlug(slug: string): { gameName: string; tagLine: string } | null {
  const decoded = decodeURIComponent(slug);
  const i = decoded.lastIndexOf("-");
  if (i <= 0 || i === decoded.length - 1) return null;
  return { gameName: decoded.slice(0, i), tagLine: decoded.slice(i + 1) };
}

/**
 * Región que sugiere un tag: "#KR1" -> kr, "#EUW" -> euw. Muchos jugadores
 * conservan el tag de su región, así que ahorra elegirla a mano.
 */
export function regionFromTag(tagLine: string | undefined, regions: readonly { slug: string; defaultTag: string }[]) {
  if (!tagLine) return undefined;
  const tag = tagLine.toUpperCase();
  return regions.find((r) => r.defaultTag === tag)?.slug;
}

/** Texto del buscador: "Nombre#TAG" o solo "Nombre" (usa el tag por defecto). */
export function parseRiotIdQuery(q: string, defaultTag: string) {
  const [name, tag] = q.split("#").map((s) => s.trim());
  if (!name) return null;
  return { gameName: name, tagLine: tag || defaultTag };
}

export function timeAgo(ms: number, now: number, locale: Locale, style: "long" | "short" = "long") {
  const rtf = new Intl.RelativeTimeFormat(intlLocale[locale], { numeric: "auto", style });
  const s = Math.round((ms - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return rtf.format(Math.round(s / (86400 * 30)), "month");
}

export function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export const fmtKda = (k: number, perfect: string) => (Number.isFinite(k) ? k.toFixed(2) : perfect);

export const thousands = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export const formatInt = (n: number, locale: Locale) => new Intl.NumberFormat(intlLocale[locale]).format(n);
