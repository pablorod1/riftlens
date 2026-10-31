import Link from "next/link";
import { Suspense } from "react";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { LocaleSwitcher } from "./locale-switcher";
import { SearchForm } from "./search-form";

export async function Logo() {
  const locale = await getLocale();
  return (
    <Link href={localePath(locale, "/")} className="flex items-center gap-2 font-bold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <circle cx="14" cy="14" r="9" fill="none" stroke="var(--color-accent)" strokeWidth="3" />
        <path d="M21 21l7 7" stroke="var(--color-accent)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M10 15.5l3-4 3 3 2-2.5" fill="none" stroke="var(--color-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg">
        rift<span className="text-accent">lens</span>
      </span>
    </Link>
  );
}

export async function SiteHeader({ search = true }: { search?: boolean }) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const nav = [
    { href: localePath(locale, "/rankings/euw"), label: dict.nav.rankings },
    { href: null, label: dict.nav.tierList },
    { href: null, label: dict.nav.champions },
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6">
        <Logo />
        <nav className="hidden items-center gap-5 text-sm md:flex">
          {nav.map((n) =>
            n.href ? (
              <Link key={n.label} href={n.href} className="text-muted hover:text-fg">
                {n.label}
              </Link>
            ) : (
              <span key={n.label} className="cursor-default text-faint" title={dict.nav.soonTitle}>
                {n.label}
                <span className="ml-1 rounded bg-panel-2 px-1 py-0.5 text-[10px] uppercase">{dict.nav.soon}</span>
              </span>
            ),
          )}
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
          {search && (
            <div className="w-full max-w-sm">
              <SearchForm size="sm" />
            </div>
          )}
          {/* usePathname depende de la URL concreta: fuera del prerender del shell */}
          <Suspense fallback={<LocaleSwitcherFallback current={locale} />}>
            <LocaleSwitcher current={locale} label={dict.nav.language} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function LocaleSwitcherFallback({ current }: { current: string }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-md border border-line text-[11px] font-semibold uppercase">
      {locales.map((l) => (
        <span key={l} className={`px-2 py-1 ${l === current ? "bg-panel-2 text-fg" : "text-faint"}`}>
          {l}
        </span>
      ))}
    </span>
  );
}
