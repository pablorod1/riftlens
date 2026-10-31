import Link from "next/link";
import { Suspense } from "react";
import { localePath, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { CommandPalette, SearchTrigger } from "./command-palette";
import { LocaleSwitcher } from "./locale-switcher";

export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="14" cy="14" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <circle cx="14" cy="14" r="5" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      <path d="M21.5 21.5 28 28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export async function Logo() {
  const locale = await getLocale();
  return (
    <Link href={localePath(locale, "/")} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
      <LogoMark />
      riftlens
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
    <header className="sticky top-0 z-30 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {nav.map((n) =>
            n.href ? (
              <Link key={n.label} href={n.href} className="rounded-md px-3 py-1.5 text-muted transition-colors hover:bg-panel-2 hover:text-fg">
                {n.label}
              </Link>
            ) : (
              <span key={n.label} className="cursor-default px-3 py-1.5 text-faint" title={dict.nav.soonTitle}>
                {n.label}
              </span>
            ),
          )}
        </nav>
        <div className="ml-auto flex flex-1 items-center justify-end gap-3">
          {search && <SearchTrigger label={dict.search.open} compact />}
          <Suspense fallback={<LocaleSwitcherFallback current={locale} />}>
            <LocaleSwitcher current={locale} label={dict.nav.language} />
          </Suspense>
        </div>
      </div>
      <CommandPalette locale={locale} labels={dict.search} regions={dict.regions} />
    </header>
  );
}

function LocaleSwitcherFallback({ current }: { current: string }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium uppercase">
      {locales.map((l) => (
        <span key={l} className={`rounded px-1.5 py-1 ${l === current ? "text-fg" : "text-faint"}`}>
          {l}
        </span>
      ))}
    </span>
  );
}
