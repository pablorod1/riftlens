"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/es";
import { matchChampions, normChampion } from "@/lib/champion-search";

/**
 * Laboratorio de matchups: tabla completa de emparejamientos (enemigos y aliados
 * en cualquier posición, ordenable y filtrable) y un comparador sin límite de
 * campeones. Todo en el cliente: los datos ya vienen agregados del servidor.
 */

export interface LabChampion {
  slug: string;
  name: string;
  icon: string;
  href: string;
}

export interface LabRow {
  championId: number;
  side: "enemy" | "ally";
  position: string;
  games: number;
  wins: number;
  /** Winrate general del otro campeón en su posición */
  otherWr: number;
  /** Solo rivales de línea con líneas temporales */
  lane?: { tlGames: number; gold10: number | null; gold15: number | null; cs15: number | null; xp15: number | null; lead15: number; lead15Wins: number } | null;
}

type Labels = Dictionary["lab"];
type SortKey = "name" | "winrate" | "d1" | "d2" | "pick" | "games" | "otherWr" | "gold15" | "cs15";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed = (x: number, digits = 1, scale = 100) => `${x >= 0 ? "+" : "−"}${Math.abs(x * scale).toFixed(digits)}`;
// Locale explícito: sin él, servidor y navegador formatean distinto (error de hidratación)
let numFmt = new Intl.NumberFormat("en-GB");
const num = (x: number) => numFmt.format(x);
const signedInt = (x: number) => `${x >= 0 ? "+" : "−"}${num(Math.abs(Math.round(x)))}`;
const wrColor = (wr: number) => (wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)");
const deltaColor = (d: number) => (Math.abs(d) < 0.005 ? "var(--color-muted)" : d > 0 ? "var(--color-win)" : "var(--color-loss)");

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; icon?: string | null }[] }) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-lg border border-line bg-panel-2/50 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${value === o.key ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {o.icon && <img src={o.icon} alt="" width={13} height={13} className={value === o.key ? "opacity-90" : "opacity-50"} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MatchupLab({
  rows,
  champs,
  allChampions,
  lanePosition,
  champWr,
  totalGames,
  positions,
  vsBase,
  vsQuery,
  initialCompare,
  labels,
  intlLocale,
}: {
  rows: LabRow[];
  /** Campeones que aparecen en las filas, por id */
  champs: Record<number, LabChampion>;
  /** Todos los campeones (para añadir cualquiera al comparador), por id */
  allChampions: Record<number, LabChampion>;
  lanePosition: string;
  champWr: number;
  totalGames: number;
  positions: { key: string; label: string; icon: string | null }[];
  /** "/es/champions/caitlyn/vs/" y "?role=bot&elo=…" para enlazar cada matchup */
  vsBase: string;
  vsQuery: string;
  initialCompare: number[];
  labels: Labels;
  /** Locale de Intl ("es-ES") para los números */
  intlLocale: string;
}) {
  if (numFmt.resolvedOptions().locale !== intlLocale) numFmt = new Intl.NumberFormat(intlLocale);
  const minSolid = Math.max(5, Math.round(totalGames * 0.005));
  const posLabel = (p: string) => positions.find((x) => x.key === p)?.label ?? p;
  const posIcon = (p: string) => positions.find((x) => x.key === p)?.icon ?? null;

  // Efecto del emparejamiento: Δ1 frente al winrate propio, Δ2 descontando además la fuerza del otro
  const d1 = (r: LabRow) => r.wins / r.games - champWr;
  const d2 = (r: LabRow) => (r.side === "enemy" ? r.wins / r.games - (champWr + (1 - r.otherWr) - 0.5) : r.wins / r.games - (champWr + r.otherWr - 0.5));

  // --- Tabla
  const [side, setSide] = useState<"enemy" | "ally">("enemy");
  const [pos, setPos] = useState<string>(lanePosition);
  const [q, setQ] = useState("");
  const [minGames, setMinGames] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "games", dir: -1 });
  const [expanded, setExpanded] = useState(false);

  const value = (r: LabRow, k: SortKey): number | string => {
    switch (k) {
      case "name":
        return champs[r.championId]?.name ?? "";
      case "winrate":
        return r.wins / r.games;
      case "d1":
        return d1(r);
      case "d2":
        return d2(r);
      case "pick":
      case "games":
        return r.games;
      case "otherWr":
        return r.otherWr;
      case "gold15":
        return r.lane?.gold15 ?? -Infinity;
      case "cs15":
        return r.lane?.cs15 ?? -Infinity;
    }
  };

  const nq = normChampion(q);
  const filtered = rows
    .filter((r) => r.side === side && (pos === "all" || r.position === pos) && r.games >= minGames)
    .filter((r) => !nq || normChampion(champs[r.championId]?.name ?? "").includes(nq))
    .sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      const c = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
      return c * sort.dir || b.games - a.games;
    });
  const visible = expanded ? filtered : filtered.slice(0, 25);
  const showLane = side === "enemy" && (pos === lanePosition || pos === "all") && rows.some((r) => r.lane?.tlGames);

  // --- Comparador (persistido en ?cmp=slug,slug para compartirlo)
  const [compare, setCompare] = useState<number[]>(initialCompare);
  const [adding, setAdding] = useState("");
  const [addActive, setAddActive] = useState(0);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (compare.length) url.searchParams.set("cmp", compare.map((id) => allChampions[id]?.slug).filter(Boolean).join(","));
    else url.searchParams.delete("cmp");
    window.history.replaceState(window.history.state, "", url);
  }, [compare, allChampions]);
  const toggle = (id: number) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const addMany = (ids: number[]) => setCompare((c) => [...c, ...ids.filter((id) => !c.includes(id))]);

  const options = Object.entries(allChampions).map(([id, c]) => ({ ...c, id: Number(id) }));
  const addMatches = adding.trim() ? matchChampions(options, adding, 8).filter((c) => !compare.includes(c.id)) : [];

  const laneRows = rows.filter((r) => r.side === "enemy" && r.position === lanePosition);
  const solidLane = laneRows.filter((r) => r.games >= minSolid);
  const quick = {
    worst: [...solidLane].sort((a, b) => d2(a) - d2(b)).slice(0, 5).map((r) => r.championId),
    best: [...solidLane].sort((a, b) => d2(b) - d2(a)).slice(0, 5).map((r) => r.championId),
    popular: [...laneRows].sort((a, b) => b.games - a.games).slice(0, 5).map((r) => r.championId),
  };

  // Por campeón comparado: rival de línea, enemigo en cualquier posición y aliado
  const summary = (id: number) => {
    const lane = laneRows.find((r) => r.championId === id) ?? null;
    const agg = (list: LabRow[]) => {
      const games = list.reduce((s, r) => s + r.games, 0);
      const wins = list.reduce((s, r) => s + r.wins, 0);
      const top = [...list].sort((a, b) => b.games - a.games)[0];
      return games ? { games, wins, wr: wins / games, top: top?.position ?? null } : null;
    };
    return {
      lane,
      enemy: agg(rows.filter((r) => r.side === "enemy" && r.championId === id)),
      ally: agg(rows.filter((r) => r.side === "ally" && r.championId === id)),
    };
  };
  const compared = compare.map((id) => ({ id, c: allChampions[id], s: summary(id) })).filter((x) => x.c);

  type Metric = { label: string; get: (s: ReturnType<typeof summary>) => number | null; fmt: (v: number) => string; color?: (v: number) => string; games: (s: ReturnType<typeof summary>) => number; higherIsBetter?: boolean };
  const R = labels.rows;
  const groups: { title: string; metrics: Metric[] }[] = [
    {
      title: `${R.lane} · ${posLabel(lanePosition)}`,
      metrics: [
        { label: R.winrate, get: (s) => (s.lane ? s.lane.wins / s.lane.games : null), fmt: pct, color: wrColor, games: (s) => s.lane?.games ?? 0, higherIsBetter: true },
        { label: R.d2, get: (s) => (s.lane ? d2(s.lane) : null), fmt: (v) => signed(v), color: deltaColor, games: (s) => s.lane?.games ?? 0, higherIsBetter: true },
        { label: R.games, get: (s) => s.lane?.games ?? null, fmt: (v) => num(v), games: () => Infinity },
        { label: R.gold10, get: (s) => s.lane?.lane?.gold10 ?? null, fmt: signedInt, color: (v) => deltaColor(v / 1000), games: (s) => s.lane?.lane?.tlGames ?? 0, higherIsBetter: true },
        { label: R.gold15, get: (s) => s.lane?.lane?.gold15 ?? null, fmt: signedInt, color: (v) => deltaColor(v / 1000), games: (s) => s.lane?.lane?.tlGames ?? 0, higherIsBetter: true },
        { label: R.cs15, get: (s) => s.lane?.lane?.cs15 ?? null, fmt: (v) => signed(v, 1, 1), color: (v) => deltaColor(v / 100), games: (s) => s.lane?.lane?.tlGames ?? 0, higherIsBetter: true },
        { label: R.xp15, get: (s) => s.lane?.lane?.xp15 ?? null, fmt: signedInt, color: (v) => deltaColor(v / 1000), games: (s) => s.lane?.lane?.tlGames ?? 0, higherIsBetter: true },
        {
          label: R.lead15,
          get: (s) => (s.lane?.lane?.tlGames ? s.lane.lane.lead15 / s.lane.lane.tlGames : null),
          fmt: pct,
          color: wrColor,
          games: (s) => s.lane?.lane?.tlGames ?? 0,
          higherIsBetter: true,
        },
        {
          label: R.leadWr,
          get: (s) => (s.lane?.lane?.lead15 ? s.lane.lane.lead15Wins / s.lane.lane.lead15 : null),
          fmt: pct,
          color: wrColor,
          games: (s) => s.lane?.lane?.lead15 ?? 0,
          higherIsBetter: true,
        },
      ],
    },
    {
      title: R.anyEnemy,
      metrics: [
        { label: R.winrate, get: (s) => s.enemy?.wr ?? null, fmt: pct, color: wrColor, games: (s) => s.enemy?.games ?? 0, higherIsBetter: true },
        { label: R.games, get: (s) => s.enemy?.games ?? null, fmt: (v) => num(v), games: () => Infinity },
      ],
    },
    {
      title: R.anyAlly,
      metrics: [
        { label: R.winrate, get: (s) => s.ally?.wr ?? null, fmt: pct, color: wrColor, games: (s) => s.ally?.games ?? 0, higherIsBetter: true },
        { label: R.games, get: (s) => s.ally?.games ?? null, fmt: (v) => num(v), games: () => Infinity },
      ],
    },
  ];

  const th = (k: SortKey, label: string, align = "text-right", title?: string) => (
    <th scope="col" className={`whitespace-nowrap px-2 py-2 font-medium ${align}`} title={title} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: k === "name" ? 1 : -1 }))}
        className={`inline-flex items-center gap-1 transition-colors hover:text-fg ${sort.key === k ? "text-fg" : ""}`}
      >
        {label}
        <span className="text-[9px] opacity-70">{sort.key === k ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ Tabla */}
      <section id="matchups" className="scroll-mt-28 rounded-2xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow" title={labels.explorerHelp}>
            {labels.explorer}
            <span className="ml-1 cursor-help text-faint/70">ⓘ</span>
          </h2>
          <p className="tabular text-[11px] text-faint">{num(filtered.length)}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Seg
            value={side}
            onChange={(v) => {
              setSide(v);
              setPos(v === "enemy" ? lanePosition : "all");
              setExpanded(false);
            }}
            options={[
              { key: "enemy", label: labels.enemies },
              { key: "ally", label: labels.allies },
            ]}
          />
          <Seg value={pos} onChange={(v) => (setPos(v), setExpanded(false))} options={[{ key: "all", label: labels.allPositions }, ...positions.filter((p) => rows.some((r) => r.side === side && r.position === p.key))]} />
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-faint">
              {labels.minGames}
              <select
                value={minGames}
                onChange={(e) => setMinGames(Number(e.target.value))}
                className="cursor-pointer rounded-md border border-line bg-panel-2 px-1.5 py-1 text-xs text-muted outline-none hover:text-fg"
              >
                {[0, 3, 5, 10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? labels.any : `${n}+`}
                  </option>
                ))}
              </select>
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.search}
              aria-label={labels.search}
              className="h-8 w-40 rounded-md border border-line bg-panel-2 px-2.5 text-xs outline-none placeholder:text-faint focus:border-line-strong"
            />
          </div>
        </div>

        <div className="-mx-5 mt-4 overflow-x-auto px-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-[11px] text-faint">
              <tr className="border-b border-line">
                <th scope="col" className="w-8 px-1 py-2">
                  <span className="sr-only">{labels.compareThis}</span>
                </th>
                {th("name", labels.col.champion, "text-left")}
                {th("winrate", labels.col.winrate)}
                {th("d1", labels.col.d1, "text-right")}
                {th("d2", labels.col.d2, "text-right")}
                {th("pick", labels.col.pick)}
                {th("games", labels.col.games)}
                {th("otherWr", side === "enemy" ? labels.col.otherWr : labels.col.otherWrAlly)}
                {showLane && th("gold15", labels.col.gold15)}
                {showLane && th("cs15", labels.col.cs15)}
                <th scope="col" className="w-8" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const c = champs[r.championId];
                const wr = r.wins / r.games;
                const thin = r.games < minSolid;
                const checked = compare.includes(r.championId);
                const isLane = r.side === "enemy" && r.position === lanePosition;
                return (
                  <tr key={`${r.side}-${r.position}-${r.championId}`} className={`border-b border-line/60 transition-colors hover:bg-panel-2/60 ${thin ? "text-muted" : ""}`}>
                    <td className="px-1 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(r.championId)}
                        aria-label={`${labels.compareThis} ${c?.name ?? ""}`}
                        className="size-3.5 cursor-pointer accent-[var(--color-accent)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Link href={isLane && c ? `${vsBase}${c.slug}${vsQuery}` : (c?.href ?? "#")} className="flex items-center gap-2.5 hover:text-accent">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c?.icon} alt="" width={28} height={28} loading="lazy" className={`rounded-md ${thin ? "opacity-60" : ""}`} />
                        <span className="truncate">{c?.name ?? "?"}</span>
                        {pos === "all" && (
                          <span className="flex items-center gap-1 text-[10px] text-faint">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {posIcon(r.position) && <img src={posIcon(r.position)!} alt="" width={11} height={11} className="opacity-60" />}
                            {posLabel(r.position)}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="tabular px-2 py-1.5 text-right">
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-panel-3 sm:block">
                          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, (wr - 0.3) / 0.4) * 100)}%`, background: wrColor(wr) }} />
                        </span>
                        <span className="font-medium" style={{ color: wrColor(wr) }}>
                          {pct(wr)}
                        </span>
                      </span>
                    </td>
                    <td className="tabular px-2 py-1.5 text-right text-xs" style={{ color: deltaColor(d1(r)) }}>
                      {signed(d1(r))}
                    </td>
                    <td className="tabular px-2 py-1.5 text-right text-xs font-medium" style={{ color: deltaColor(d2(r)) }}>
                      {signed(d2(r))}
                    </td>
                    <td className="tabular px-2 py-1.5 text-right text-xs text-muted">{pct(r.games / Math.max(1, totalGames))}</td>
                    <td className="tabular px-2 py-1.5 text-right text-xs text-muted">{num(r.games)}</td>
                    <td className="tabular px-2 py-1.5 text-right text-xs text-muted">{pct(r.otherWr)}</td>
                    {showLane && (
                      <td className="tabular px-2 py-1.5 text-right text-xs" style={{ color: r.lane?.gold15 != null ? deltaColor(r.lane.gold15 / 1000) : undefined }}>
                        {r.lane?.gold15 != null && r.lane.tlGames ? signedInt(r.lane.gold15) : <span className="text-faint">—</span>}
                      </td>
                    )}
                    {showLane && (
                      <td className="tabular px-2 py-1.5 text-right text-xs" style={{ color: r.lane?.cs15 != null ? deltaColor(r.lane.cs15 / 100) : undefined }}>
                        {r.lane?.cs15 != null && r.lane.tlGames ? signed(r.lane.cs15, 1, 1) : <span className="text-faint">—</span>}
                      </td>
                    )}
                    <td className="px-1 py-1.5 text-right">
                      {isLane && c && (
                        <Link href={`${vsBase}${c.slug}${vsQuery}`} title={labels.openVs} aria-label={`${labels.openVs}: ${c.name}`} className="inline-flex size-6 items-center justify-center rounded-md text-faint hover:bg-panel-3 hover:text-fg">
                          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-sm text-faint">
                    {labels.noRows}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 25 && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-3 w-full rounded-lg border border-line py-2 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg">
            {expanded ? labels.showLess : labels.showAll.replace("{n}", String(filtered.length))}
          </button>
        )}
        <p className="mt-3 text-[11px] text-faint">{labels.sampleNote.replace("{n}", String(minSolid))}</p>
      </section>

      {/* ------------------------------------------------------- Comparador */}
      <section id="compare" className="scroll-mt-28 rounded-2xl border border-line bg-panel p-5">
        <h2 className="eyebrow">{labels.compare}</h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted">{labels.compareHelp}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={adding}
              onChange={(e) => {
                setAdding(e.target.value);
                setAddActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setAddActive((a) => Math.min(addMatches.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setAddActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter" && addMatches[addActive]) {
                  e.preventDefault();
                  addMany([addMatches[addActive]!.id]);
                  setAdding("");
                } else if (e.key === "Escape") setAdding("");
              }}
              placeholder={labels.add}
              aria-label={labels.add}
              role="combobox"
              aria-expanded={addMatches.length > 0}
              aria-controls="lab-add-list"
              className="h-9 w-52 rounded-lg border border-line bg-panel-2 px-3 text-sm outline-none placeholder:text-faint focus:border-accent/60"
            />
            {addMatches.length > 0 && (
              <ul id="lab-add-list" role="listbox" className="absolute left-0 top-10 z-20 w-64 animate-pop overflow-hidden rounded-xl border border-line-strong bg-panel p-1 shadow-2xl shadow-black/50">
                {addMatches.map((c, i) => (
                  <li
                    key={c.id}
                    role="option"
                    aria-selected={i === addActive}
                    onMouseEnter={() => setAddActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addMany([c.id]);
                      setAdding("");
                    }}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${i === addActive ? "bg-panel-3" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.icon} alt="" width={24} height={24} className="rounded-md" />
                    <span className="flex-1 truncate">{c.name}</span>
                    {laneRows.some((r) => r.championId === c.id) && <span className="size-1.5 rounded-full bg-accent" />}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {quick.worst.length > 0 && (
            <button type="button" onClick={() => addMany(quick.worst)} className="h-9 rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-loss/40 hover:text-loss">
              {labels.addWorst}
            </button>
          )}
          {quick.best.length > 0 && (
            <button type="button" onClick={() => addMany(quick.best)} className="h-9 rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-win/40 hover:text-win">
              {labels.addBest}
            </button>
          )}
          {quick.popular.length > 0 && (
            <button type="button" onClick={() => addMany(quick.popular)} className="h-9 rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg">
              {labels.addPopular}
            </button>
          )}
          {compare.length > 0 && (
            <button type="button" onClick={() => setCompare([])} className="ml-auto h-9 px-2 text-xs text-faint hover:text-fg">
              {labels.clear}
            </button>
          )}
        </div>

        {compared.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-muted">{labels.compareEmpty}</p>
        ) : (
          <>
            {/* Barras de winrate en línea, centradas en el 50 % */}
            <div className="mt-5 rounded-xl border border-line bg-panel-2/30 p-4">
              <p className="eyebrow mb-3">{labels.laneWrChart}</p>
              <ul className="space-y-1.5">
                {[...compared]
                  .sort((a, b) => (b.s.lane ? b.s.lane.wins / b.s.lane.games : -1) - (a.s.lane ? a.s.lane.wins / a.s.lane.games : -1))
                  .map(({ id, c, s }) => {
                    const wr = s.lane ? s.lane.wins / s.lane.games : null;
                    const off = wr === null ? 0 : Math.max(-0.25, Math.min(0.25, wr - 0.5));
                    return (
                      <li key={id} className="flex items-center gap-3 text-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c!.icon} alt="" width={20} height={20} className="rounded" />
                        <span className="w-24 truncate text-muted">{c!.name}</span>
                        <span className="relative h-3 flex-1 rounded-full bg-panel-3/60">
                          <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                          {wr !== null && (
                            <span
                              className="absolute inset-y-0 rounded-full"
                              style={{
                                left: off >= 0 ? "50%" : `${50 + (off / 0.25) * 50}%`,
                                width: `${(Math.abs(off) / 0.25) * 50}%`,
                                background: wrColor(wr),
                                opacity: (s.lane?.games ?? 0) < minSolid ? 0.4 : 0.85,
                              }}
                            />
                          )}
                        </span>
                        <span className="tabular w-14 text-right font-medium" style={{ color: wr === null ? undefined : wrColor(wr) }}>
                          {wr === null ? labels.noData : pct(wr)}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>

            {/* Tabla métrica × campeón: tantas columnas como campeones */}
            <div className="-mx-5 mt-5 overflow-x-auto px-5">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-36 bg-panel" />
                    {compared.map(({ id, c, s }) => (
                      <th key={id} className="min-w-24 px-2 pb-3 align-bottom font-normal">
                        <div className="group relative flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggle(id)}
                            aria-label={labels.remove.replace("{champion}", c!.name)}
                            className="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full border border-line-strong bg-panel text-[10px] text-faint opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            ✕
                          </button>
                          <Link href={s.lane ? `${vsBase}${c!.slug}${vsQuery}` : c!.href} className="flex flex-col items-center gap-1 hover:text-accent">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c!.icon} alt="" width={40} height={40} className="rounded-lg ring-1 ring-line" />
                            <span className="max-w-24 truncate text-xs text-fg">{c!.name}</span>
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.title}>
                    <tr>
                      <th colSpan={compared.length + 1} className="sticky left-0 bg-panel pb-1 pt-4 text-left">
                        <span className="eyebrow">{g.title}</span>
                      </th>
                    </tr>
                    {g.metrics.map((m) => {
                      const vals = compared.map(({ s }) => ({ v: m.get(s), thin: m.games(s) < minSolid }));
                      const solidVals = vals.filter((x) => x.v !== null && !x.thin).map((x) => x.v!);
                      const best = m.higherIsBetter && solidVals.length > 1 ? Math.max(...solidVals) : null;
                      const worst = m.higherIsBetter && solidVals.length > 1 ? Math.min(...solidVals) : null;
                      return (
                        <tr key={m.label} className="border-t border-line/60">
                          <th scope="row" className="sticky left-0 z-10 bg-panel py-1.5 pr-3 text-left font-normal text-muted">
                            {m.label}
                          </th>
                          {vals.map(({ v, thin }, i) => (
                            <td key={compared[i]!.id} className={`tabular px-2 py-1.5 text-center ${thin && v !== null ? "opacity-45" : ""}`}>
                              {v === null ? (
                                <span className="text-faint">{labels.noData}</span>
                              ) : (
                                <span
                                  className={`rounded px-1.5 py-0.5 ${v === best ? "bg-win/10 font-semibold" : v === worst ? "bg-loss/10" : ""}`}
                                  style={{ color: m.color?.(v) }}
                                >
                                  {m.fmt(v)}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
                <tbody>
                  <tr className="border-t border-line/60">
                    <th scope="row" className="sticky left-0 z-10 bg-panel py-1.5 pr-3 text-left font-normal text-muted">
                      {R.bestPos}
                    </th>
                    {compared.map(({ id, s }) => {
                      const p = s.enemy?.top ?? s.ally?.top;
                      return (
                        <td key={id} className="px-2 py-1.5 text-center text-muted">
                          {p ? (
                            <span className="inline-flex items-center gap-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {posIcon(p) && <img src={posIcon(p)!} alt="" width={11} height={11} className="opacity-60" />}
                              {posLabel(p)}
                            </span>
                          ) : (
                            <span className="text-faint">{labels.noData}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td />
                    {compared.map(({ id, c, s }) => (
                      <td key={id} className="px-2 pt-3 text-center">
                        {s.lane && (
                          <Link href={`${vsBase}${c!.slug}${vsQuery}`} className="whitespace-nowrap text-[11px] text-accent/80 hover:text-accent">
                            {labels.vsLink}
                          </Link>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-faint">{labels.sampleNote.replace("{n}", String(minSolid))}</p>
          </>
        )}
      </section>
    </div>
  );
}

