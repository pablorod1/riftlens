import Link from "next/link";
import { HeroSearch } from "@/components/hero-search";
import { SiteHeader } from "@/components/site-header";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function Home() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const h = dict.home;
  return (
    <>
      <SiteHeader search={false} />
      <main className="relative flex-1 overflow-hidden">
        {/* Halo sutil detrás del titular */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
          style={{ background: "radial-gradient(ellipse 50% 60% at 50% 0%, rgb(142 230 208 / 0.08), transparent 70%)" }}
        />
        <section className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pt-24 pb-20 text-center sm:pt-32">
          <p className="eyebrow animate-fade-up">{h.eyebrow}</p>
          <h1 className="mt-5 animate-fade-up text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl [animation-delay:60ms]">
            {h.titleStart}{" "}
            <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.01em] text-accent-strong">{h.titleAccent}</span>
          </h1>
          <p className="mt-5 max-w-xl animate-fade-up text-[15px] leading-relaxed text-muted text-balance [animation-delay:120ms]">
            {h.subtitle}
          </p>
          <div className="mt-12 w-full animate-fade-up text-left [animation-delay:180ms]">
            <HeroSearch locale={locale} labels={dict.search} regions={dict.regions} />
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-5 pb-24">
          <ol className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {h.features.map((f, i) => (
              <li key={f.title} className="border-b border-line py-6 sm:pr-8 lg:border-b-0 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0">
                <p className="tabular text-xs text-faint">0{i + 1}</p>
                <p className="mt-3 flex items-center gap-2 font-medium">
                  {f.title}
                  {!f.ready && <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-normal text-faint">{dict.nav.soon}</span>}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </li>
            ))}
          </ol>
          <Link href={localePath(locale, "/rankings/euw")} className="mt-10 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg">
            {h.ladderLink}
          </Link>
        </section>
      </main>
    </>
  );
}
