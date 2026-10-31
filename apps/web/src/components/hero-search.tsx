"use client";

import { REGIONS } from "@riftlens/riot";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { searchSummoner } from "@/app/actions";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/es";
import { parseRiotIdQuery, regionFromTag, summonerPath } from "@/lib/format";
import { Kbd, SearchGlyph } from "./search-icons";
import { useRecent } from "./use-recent";

/**
 * Búsqueda principal de la portada. Funciona sin JS (server action) y, con JS,
 * navega al instante y enseña cómo se interpretará el Riot ID.
 */
export function HeroSearch({ locale, labels, regions }: { locale: Locale; labels: Dictionary["search"]; regions: Dictionary["regions"] }) {
  const router = useRouter();
  const recent = useRecent();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("euw");
  // Si el tag escrito es el de una región (#KR1, #NA1…), usamos esa región.
  const typedTag = query.includes("#") ? query.split("#")[1]?.trim() : undefined;
  const effectiveRegion = regionFromTag(typedTag, REGIONS) ?? region;
  const info = REGIONS.find((r) => r.slug === effectiveRegion) ?? REGIONS[0];
  const parsed = parseRiotIdQuery(query, info.defaultTag);

  return (
    <div className="w-full">
      <form
        action={searchSummoner}
        onSubmit={(e) => {
          if (!parsed) return;
          e.preventDefault();
          router.push(summonerPath(locale, effectiveRegion, parsed.gameName, parsed.tagLine));
        }}
        role="search"
        className="group flex h-16 w-full items-center gap-3 rounded-2xl border border-line-strong bg-panel pl-5 pr-2 shadow-[0_0_0_6px_rgb(255_255_255/0.015)] transition-colors focus-within:border-accent/60"
      >
        <input type="hidden" name="lang" value={locale} />
        <SearchGlyph className="size-5 shrink-0 text-faint" />
        <input
          name="q"
          required
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.placeholder}
          aria-label="Riot ID"
          className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none focus-visible:outline-none placeholder:text-faint"
        />
        <label className="sr-only" htmlFor="hero-region">
          {labels.region}
        </label>
        <select
          id="hero-region"
          name="region"
          value={effectiveRegion}
          onChange={(e) => setRegion(e.target.value)}
          className="cursor-pointer rounded-lg bg-panel-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted outline-none hover:text-fg"
        >
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.slug.toUpperCase()}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-12 rounded-xl bg-fg px-5 text-sm font-semibold text-bg transition-colors hover:bg-accent-strong"
        >
          {labels.button}
        </button>
      </form>

      <p className="mt-3 h-4 px-1 text-xs text-faint" aria-live="polite">
        {parsed ? (
          t(labels.preview, { riotId: `${parsed.gameName}#${parsed.tagLine}`, region: regions[effectiveRegion as keyof typeof regions] })
        ) : (
          <span className="flex items-center gap-1.5">
            {t(labels.hint, { example: "Name#EUW" })}
            <span className="hidden items-center gap-1 sm:inline-flex">
              · <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </span>
        )}
      </p>

      {recent.length > 0 && (
        <div className="mt-8 animate-fade-up">
          <p className="eyebrow mb-3">{labels.recent}</p>
          <ul className="flex flex-wrap gap-2">
            {recent.slice(0, 6).map((r) => (
              <li key={`${r.region}-${r.gameName}-${r.tagLine}`}>
                <Link
                  href={summonerPath(locale, r.region, r.gameName, r.tagLine)}
                  className="flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3 text-sm transition-colors hover:border-line-strong"
                >
                  {r.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.iconUrl} alt="" className="size-6 rounded-full" />
                  ) : (
                    <span className="size-6 rounded-full bg-panel-3" />
                  )}
                  <span>{r.gameName}</span>
                  <span className="text-xs text-faint">{r.region.toUpperCase()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
