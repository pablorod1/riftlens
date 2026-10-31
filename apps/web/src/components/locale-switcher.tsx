"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

/** Cambia el prefijo de idioma de la ruta actual: /es/rankings/euw -> /en/rankings/euw */
export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const rest = pathname.replace(/^\/[^/]+/, "");
  return (
    <nav aria-label={label} className="flex shrink-0 overflow-hidden rounded-md border border-line text-[11px] font-semibold uppercase">
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}`}
          hrefLang={l}
          title={localeNames[l]}
          aria-current={l === current ? "true" : undefined}
          className={`px-2 py-1 ${l === current ? "bg-panel-2 text-fg" : "text-faint hover:text-fg"}`}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
