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
import { useSuggestions } from "./use-suggestions";

/**
 * Búsqueda principal de la portada. Funciona sin JS (server action) y, con JS,
 * navega al instante y enseña cómo se interpretará el Riot ID.
 */
export function HeroSearch({ locale, labels, regions }: { locale: Locale; labels: Dictionary["search"]; regions: Dictionary["regions"] }) {
  const router = useRouter();
  const recent = useRecent();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("euw");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  // Si el tag escrito es el de una región (#KR1, #NA1…), usamos esa región.
  const typedTag = query.includes("#") ? query.split("#")[1]?.trim() : undefined;
  const effectiveRegion = regionFromTag(typedTag, REGIONS) ?? region;
  const info = REGIONS.find((r) => r.slug === effectiveRegion) ?? REGIONS[0];
  const parsed = parseRiotIdQuery(query, info.defaultTag);
  const suggestions = useSuggestions(query, effectiveRegion, locale);
  const showList = focused && suggestions.length > 0;
  const goTo = (s: (typeof suggestions)[number]) => router.push(summonerPath(locale, s.region, s.gameName, s.tagLine));

  return (
    <div className="relative w-full">
      <form
        action={searchSummoner}
        onSubmit={(e) => {
          if (!parsed) return;
          e.preventDefault();
          const picked = showList ? suggestions[active] : undefined;
          if (picked) goTo(picked);
          else router.push(summonerPath(locale, effectiveRegion, parsed.gameName, parsed.tagLine));
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
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
            // El foco automático llega antes de hidratar: abrimos la lista al escribir
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          // Retraso para que un clic en una sugerencia llegue antes de ocultarlas
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(suggestions.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") setFocused(false);
          }}
          role="combobox"
          aria-expanded={showList}
          aria-controls="hero-suggestions"
          aria-activedescendant={showList && active >= 0 ? `hero-s-${active}` : undefined}
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

      {showList && (
        <ul
          id="hero-suggestions"
          role="listbox"
          className="absolute inset-x-0 top-[72px] z-20 animate-pop overflow-hidden rounded-2xl border border-line-strong bg-panel p-1.5 shadow-2xl shadow-black/50"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.region}-${s.gameName}-${s.tagLine}`}
              id={`hero-s-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                goTo(s);
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm ${i === active ? "bg-panel-3" : ""}`}
            >
              {s.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.iconUrl} alt="" className="size-8 rounded-full" />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full bg-panel-3 text-xs font-medium text-muted">
                  {s.gameName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">
                {s.gameName}
                <span className="text-faint">#{s.tagLine}</span>
              </span>
              <span className="text-xs text-faint">{[s.rank, s.region.toUpperCase()].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}

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
