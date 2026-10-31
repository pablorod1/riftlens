import Link from "next/link";
import { SearchForm } from "./search-form";

const NAV = [
  { href: "/rankings/euw", label: "Rankings" },
  { href: null, label: "Tier list" },
  { href: null, label: "Campeones" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
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

export function SiteHeader({ search = true }: { search?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="hidden items-center gap-5 text-sm sm:flex">
          {NAV.map((n) =>
            n.href ? (
              <Link key={n.label} href={n.href} className="text-muted hover:text-fg">
                {n.label}
              </Link>
            ) : (
              <span key={n.label} className="cursor-default text-faint" title="Próximamente">
                {n.label}
                <span className="ml-1 rounded bg-panel-2 px-1 py-0.5 text-[10px] uppercase">pronto</span>
              </span>
            ),
          )}
        </nav>
        {search && (
          <div className="ml-auto w-full max-w-sm">
            <SearchForm size="sm" />
          </div>
        )}
      </div>
    </header>
  );
}
