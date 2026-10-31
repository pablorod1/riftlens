"use client";

import { ddragonImg } from "@riftlens/riot";
import Link from "next/link";
import { useState } from "react";

const wrColor = (wr: number) => (wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)");
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}`;

export interface ChampRef {
  name: string;
  icon: string;
  href: string;
}

function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-line bg-panel-2/50 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs ${value === o.key ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Counters y sinergias por posición

export interface PairRow {
  championId: number;
  games: number;
  wins: number;
  /** Winrate general del otro campeón en su rol */
  otherWr: number;
}

type Mode = "common" | "strong" | "weak" | "delta";

export function PairsExplorer({
  counters,
  synergy,
  champWr,
  totalGames,
  positions,
  champs,
  labels,
}: {
  counters: Record<string, PairRow[]>;
  synergy: Record<string, PairRow[]>;
  champWr: number;
  totalGames: number;
  positions: { key: string; label: string; icon: string | null }[];
  champs: Record<number, ChampRef>;
  labels: { counters: string; synergy: string; common: string; strong: string; weak: string; delta: string; vs: string; with: string; d1: string; d1Help: string; d2: string; d2Help: string; pick: string; games: string };
}) {
  const [kind, setKind] = useState<"counters" | "synergy">("counters");
  const [mode, setMode] = useState<Mode>("common");
  const source = kind === "counters" ? counters : synergy;
  const minGames = Math.max(5, Math.round(totalGames * 0.005));

  // Δ1: contra el winrate general del campeón. Δ2: además descontando la fuerza del otro.
  const d1 = (r: PairRow) => r.wins / r.games - champWr;
  const d2 = (r: PairRow) => (kind === "counters" ? r.wins / r.games - (champWr + (1 - r.otherWr) - 0.5) : r.wins / r.games - (champWr + r.otherWr - 0.5));
  const order = (list: PairRow[]) => {
    const solid = list.filter((r) => r.games >= minGames);
    if (mode === "common") return [...list].sort((a, b) => b.games - a.games);
    if (mode === "strong") return solid.sort((a, b) => d2(b) - d2(a));
    if (mode === "weak") return solid.sort((a, b) => d2(a) - d2(b));
    return solid.sort((a, b) => Math.abs(d2(b)) - Math.abs(d2(a)));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={kind} onChange={setKind} options={[{ key: "counters", label: labels.counters }, { key: "synergy", label: labels.synergy }]} />
        <Tabs
          value={mode}
          onChange={setMode}
          options={[
            { key: "common", label: labels.common },
            { key: "strong", label: labels.strong },
            { key: "weak", label: labels.weak },
            { key: "delta", label: labels.delta },
          ]}
        />
      </div>
      <div className="space-y-4">
        {positions
          .filter((p) => source[p.key]?.length)
          .map((p) => (
            <div key={p.key} className="flex gap-3">
              <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-panel-2/60 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.icon && <img src={p.icon} alt="" width={18} height={18} className="opacity-70" />}
                <span className="text-[10px] leading-tight text-faint">{(kind === "counters" ? labels.vs : labels.with).replace("{role}", p.label)}</span>
              </div>
              <ol className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
                {order(source[p.key]!).slice(0, 14).map((r) => {
                  const c = champs[r.championId];
                  const wr = r.wins / r.games;
                  return (
                    <li key={r.championId} className="w-[68px] shrink-0">
                      <Link href={c?.href ?? "#"} className="block rounded-xl border border-line bg-panel-2/40 p-1.5 text-center transition-colors hover:border-line-strong">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c?.icon} alt={c?.name} title={c?.name} width={40} height={40} className={`mx-auto rounded-lg ${r.games < minGames ? "opacity-50" : ""}`} />
                        <p className="tabular mt-1 text-[11px] font-medium" style={{ color: wrColor(wr) }}>
                          {pct(wr)}
                        </p>
                        <p className="tabular text-[10px] text-muted" title={labels.d1Help}>
                          {labels.d1} {signed(d1(r))}
                        </p>
                        <p className="tabular text-[10px] text-muted" title={labels.d2Help}>
                          {labels.d2} {signed(d2(r))}
                        </p>
                        <p className="tabular text-[10px] text-faint" title={labels.games}>
                          {r.games.toLocaleString()}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explorador de objetos

export interface ItemRow {
  key: string;
  items: number[];
  games: number;
  wins: number;
  minute?: number;
}

export function ItemsExplorer({
  tabs,
  version,
  itemNames,
  totalGames,
  labels,
}: {
  tabs: { key: string; label: string; rows: ItemRow[] }[];
  version: string;
  itemNames: Record<number, string>;
  totalGames: number;
  labels: { pick: string; games: string; minute: string };
}) {
  const [tab, setTab] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  return (
    <div>
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} options={tabs.map((t) => ({ key: t.key, label: t.label }))} />
      </div>
      {!current?.rows.length ? (
        <p className="text-sm text-faint">—</p>
      ) : (
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
          {current.rows.map((r) => {
            const wr = r.games ? r.wins / r.games : 0;
            return (
              <li key={r.key} className="rounded-xl border border-line bg-panel-2/40 p-2 text-center" title={r.items.map((i) => itemNames[i] ?? i).join(" + ")}>
                <div className="flex justify-center gap-0.5">
                  {r.items.map((id, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={ddragonImg.item(version, id)} alt="" width={r.items.length > 2 ? 22 : 32} height={r.items.length > 2 ? 22 : 32} className="rounded-md" />
                  ))}
                </div>
                <p className="tabular mt-1.5 text-xs font-medium" style={{ color: wrColor(wr) }}>
                  {pct(wr)}
                </p>
                <p className="tabular text-[10px] text-muted" title={labels.pick}>
                  {pct(r.games / Math.max(1, totalGames))}
                </p>
                <p className="tabular text-[10px] text-faint" title={labels.games}>
                  {r.games.toLocaleString()}
                  {r.minute !== undefined ? ` · ${labels.minute.replace("{m}", String(r.minute))}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
