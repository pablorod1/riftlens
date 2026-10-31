import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { Logo, SiteHeader } from "@/components/site-header";
import { localePath, t } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function Home() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const h = dict.home;
  return (
    <>
      <SiteHeader search={false} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pt-20 pb-16 sm:pt-28">
        <div className="scale-150">
          <Logo />
        </div>
        <h1 className="mt-8 text-center text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {h.titleStart} <span className="text-accent">{h.titleAccent}</span>
        </h1>
        <p className="mt-3 text-center text-muted text-balance">{h.subtitle}</p>
        <div className="mt-10 w-full">
          <SearchForm />
          <p className="mt-2 text-center text-xs text-faint">{t(dict.search.hint, { example: "Name#EUW" })}</p>
        </div>

        <div className="mt-16 grid w-full gap-3 sm:grid-cols-2">
          {h.features.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-panel p-4">
              <p className="flex items-center gap-2 font-semibold">
                {f.title}
                {!f.ready && (
                  <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase text-faint">{dict.nav.soon}</span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
        <Link href={localePath(locale, "/rankings/euw")} className="mt-8 text-sm text-accent hover:underline">
          {h.ladderLink}
        </Link>
      </main>
    </>
  );
}
