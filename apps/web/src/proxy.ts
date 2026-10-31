import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, locales, type Locale } from "./i18n/config";

/** Elige idioma: cookie (elección previa) > Accept-Language > por defecto. */
function preferredLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;

  const header = req.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag!.toLowerCase().split("-")[0]!, q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.lang))?.lang as Locale | undefined ?? defaultLocale;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const current = locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (current) {
    // Recordamos el idioma que el usuario está viendo (p. ej. tras usar el selector).
    const res = NextResponse.next();
    if (req.cookies.get(LOCALE_COOKIE)?.value !== current) {
      res.cookies.set(LOCALE_COOKIE, current, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Todo menos internos de Next y ficheros con extensión (favicon, imágenes…)
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
