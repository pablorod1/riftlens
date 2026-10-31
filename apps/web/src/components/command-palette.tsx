"use client";

import { REGIONS } from "@riftlens/riot";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/es";
import { parseRiotIdQuery, regionFromTag, summonerPath } from "@/lib/format";
import { clearRecent, OPEN_SEARCH_EVENT, removeRecent, type RecentSummoner } from "@/lib/recent";
import { Kbd, SearchGlyph } from "./search-icons";
import { useRecent } from "./use-recent";

interface Props {
  locale: Locale;
  labels: Dictionary["search"];
  regions: Dictionary["regions"];
  champions: { slug: string; name: string; icon: string }[];
}

/** Normaliza para buscar campeones sin acentos ni signos ("kaisa" encuentra "Kai'Sa"). */
const norm = (s: string) => s.normalize("NFD").replace(/[^a-z0-9]/gi, "").toLowerCase();

/** Abre la paleta desde cualquier sitio (botón de la cabecera, portada…). */
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

/**
 * Búsqueda global: ⌘K / Ctrl+K o "/" desde cualquier página.
 * Muestra cómo se interpretará el Riot ID y las búsquedas recientes.
 */
export function CommandPalette({ locale, labels, regions, champions }: Props) {
  const router = useRouter();
  const recent = useRecent();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("euw");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // Si el tag escrito es el de una región (#KR1, #NA1…), usamos esa región.
  const typedTag = query.includes("#") ? query.split("#")[1]?.trim() : undefined;
  const effectiveRegion = regionFromTag(typedTag, REGIONS) ?? region;
  const regionInfo = REGIONS.find((r) => r.slug === effectiveRegion) ?? REGIONS[0];
  const parsed = parseRiotIdQuery(query, regionInfo.defaultTag);
  // Sin "#" puede ser un campeón: los que coinciden van primero.
  const q = norm(query);
  const champMatches =
    q.length >= 2 && !query.includes("#")
      ? champions.filter((c) => norm(c.name).startsWith(q) || c.slug.startsWith(q)).slice(0, 4)
      : [];
  // Después, buscar el Riot ID escrito y, por último, los recientes.
  const items: ({ kind: "search" } | { kind: "champion"; champ: Props["champions"][number] } | { kind: "recent"; entry: RecentSummoner })[] = [
    ...champMatches.map((champ) => ({ kind: "champion" as const, champ })),
    ...(parsed ? [{ kind: "search" as const }] : []),
    ...recent
      .filter((r) => !query || `${r.gameName}#${r.tagLine}`.toLowerCase().includes(query.toLowerCase()))
      .map((entry) => ({ kind: "recent" as const, entry })),
  ];

  const go = (i: number) => {
    const item = items[i];
    if (!item) return;
    const href =
      item.kind === "champion"
        ? `/${locale}/champions/${item.champ.slug}`
        : item.kind === "search"
          ? summonerPath(locale, effectiveRegion, parsed!.gameName, parsed!.tagLine)
          : summonerPath(locale, item.entry.region, item.entry.gameName, item.entry.tagLine);
    close();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(active);
    }
  };

  // Portal a <body>: la cabecera usa backdrop-filter, que atraparía el position: fixed.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labels.open}
        className="w-full max-w-xl animate-pop overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchGlyph className="size-5 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={labels.placeholder}
            spellCheck={false}
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items.length ? `${listId}-${active}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:outline-none placeholder:text-faint"
          />
          <label className="sr-only" htmlFor={`${listId}-region`}>
            {labels.region}
          </label>
          <select
            id={`${listId}-region`}
            value={effectiveRegion}
            onChange={(e) => setRegion(e.target.value)}
            className="cursor-pointer rounded-md border border-line bg-panel-2 px-2 py-1 text-xs font-medium uppercase text-muted outline-none hover:text-fg"
          >
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.slug.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.map((item, i) => {
            const selected = i === active;
            const base = `flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
              selected ? "bg-panel-3" : ""
            }`;
            if (item.kind === "champion") {
              return (
                <li key={`c-${item.champ.slug}`} id={`${listId}-${i}`} role="option" aria-selected={selected} className={base} onMouseEnter={() => setActive(i)} onClick={() => go(i)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.champ.icon} alt="" className="size-8 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.champ.name}</span>
                    <span className="block text-xs text-faint">{labels.championHint}</span>
                  </span>
                  <span className="text-xs text-faint">↵</span>
                </li>
              );
            }
            if (item.kind === "search") {
              return (
                <li key="search" id={`${listId}-${i}`} role="option" aria-selected={selected} className={base} onMouseEnter={() => setActive(i)} onClick={() => go(i)}>
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <SearchGlyph className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {parsed!.gameName}
                      <span className="text-faint">#{parsed!.tagLine}</span>
                    </span>
                    <span className="block text-xs text-faint">
                      {t(labels.preview, { riotId: `${parsed!.gameName}#${parsed!.tagLine}`, region: regions[effectiveRegion as keyof typeof regions] })}
                    </span>
                  </span>
                  <span className="text-xs text-faint">↵</span>
                </li>
              );
            }
            const r = item.entry;
            return (
              <li key={`${r.region}-${r.gameName}-${r.tagLine}`} id={`${listId}-${i}`} role="option" aria-selected={selected} className={`group ${base}`} onMouseEnter={() => setActive(i)} onClick={() => go(i)}>
                {r.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.iconUrl} alt="" className="size-8 rounded-full" />
                ) : (
                  <span className="size-8 rounded-full bg-panel-3" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {r.gameName}
                    <span className="text-faint">#{r.tagLine}</span>
                  </span>
                  <span className="block text-xs text-faint">
                    {r.region.toUpperCase()}
                    {r.rank ? ` · ${r.rank}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={labels.clear}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecent(r);
                  }}
                  className="rounded p-1 text-faint opacity-0 hover:text-fg group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            );
          })}
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-faint">{labels.noRecent}</li>}
        </ul>

        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11px] text-faint">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> {labels.navigate}
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> {labels.select}
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> {labels.close}
            </span>
          </span>
          {recent.length > 0 && !query && (
            <button type="button" onClick={clearRecent} className="hover:text-fg">
              {labels.clear}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Botón con aspecto de campo de búsqueda que abre la paleta. */
export function SearchTrigger({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={openSearch}
      className={`group flex items-center gap-2.5 rounded-lg border border-line bg-panel text-sm text-faint transition-colors hover:border-line-strong hover:text-muted ${
        compact ? "h-9 w-full max-w-xs px-3" : "h-14 w-full px-5 text-base"
      }`}
    >
      <SearchGlyph className={compact ? "size-4" : "size-5"} />
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="hidden items-center gap-1 sm:flex">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
