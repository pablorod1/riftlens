"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

/** Cambia el prefijo de idioma de la ruta actual: /es/rankings/euw -> /en/rankings/euw */
export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const rest = pathname.replace(/^\/[^/]+/, "");
  return (
    <nav aria-label={label} className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium uppercase">
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}`}
          hrefLang={l}
          title={localeNames[l]}
          aria-current={l === current ? "true" : undefined}
          className={`rounded px-1.5 py-1 transition-colors ${l === current ? "text-fg" : "text-faint hover:text-muted"}`}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
