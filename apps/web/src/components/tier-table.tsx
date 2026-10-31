"use client";

import type { Tier } from "@riftlens/core";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TierBadge } from "./tier-badge";

export interface TierRow {
  key: string;
  href: string;
  name: string;
  icon: string;
  roleIcon: string | null;
  roleLabel: string;
  tier: Tier;
  score: number;
  winrate: number;
  low: number;
  high: number;
  pickRate: number;
  banRate: number;
  games: number;
  lowSample: boolean;
}

type SortKey = "score" | "winrate" | "pickRate" | "banRate" | "games" | "name";

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

/** Tier list ordenable y filtrable al instante (los datos ya vienen del servidor). */
export function TierTable({
  rows,
  showRole,
  labels,
}: {
  rows: TierRow[];
  showRole: boolean;
  labels: { champion: string; tier: string; winrate: string; pickRate: string; banRate: string; games: string; filter: string; noResults: string; lowSample: string };
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows];
    list.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      return (typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number)) * sort.dir;
    });
    return list;
  }, [rows, query, sort]);

  const header = (key: SortKey, label: string, align = "text-right") => (
    <th className={`py-3 font-medium ${align}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "name" ? 1 : -1 }))}
        className={`eyebrow inline-flex items-center gap-1 transition-colors hover:text-muted ${sort.key === key ? "text-muted" : ""}`}
      >
        {label}
        <span className="w-2 text-[9px]">{sort.key === key ? (sort.dir === -1 ? "↓" : "↑") : ""}</span>
      </button>
    </th>
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.filter}
        aria-label={labels.filter}
        className="mb-3 h-9 w-full max-w-xs rounded-lg border border-line bg-panel px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong focus-visible:outline-none"
      />
      <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr>
              <th className="eyebrow w-12 py-3 pl-5 text-left font-medium">#</th>
              {header("name", labels.champion, "text-left")}
              {header("score", labels.tier, "text-center")}
              {header("winrate", labels.winrate)}
              {header("pickRate", labels.pickRate)}
              {header("banRate", labels.banRate)}
              {header("games", labels.games, "pr-5 text-right")}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.key} className="border-t border-line transition-colors hover:bg-panel-2">
                <td className="tabular py-2 pl-5 text-xs text-faint">{i + 1}</td>
                <td className="py-2">
                  <Link href={r.href} className="flex items-center gap-3 font-medium transition-colors hover:text-accent">
                    <Image src={r.icon} alt="" width={32} height={32} className="rounded-lg" />
                    <span className="truncate">{r.name}</span>
                    {showRole && r.roleIcon && <Image src={r.roleIcon} alt={r.roleLabel} title={r.roleLabel} width={14} height={14} className="opacity-60" />}
                  </Link>
                </td>
                <td className="py-2 text-center">
                  <TierBadge tier={r.tier} />
                </td>
                <td className="py-2 text-right">
                  <span
                    className="tabular font-medium"
                    style={{ color: r.winrate >= 0.5 ? "var(--color-win)" : "var(--color-loss)" }}
                    title={`${pct(r.low)} – ${pct(r.high)} (95%)`}
                  >
                    {pct(r.winrate)}
                  </span>
                  {r.lowSample && (
                    <span className="ml-1.5 text-[10px] text-faint" title={labels.lowSample}>
                      ±{Math.round(((r.high - r.low) / 2) * 100)}
                    </span>
                  )}
                </td>
                <td className="tabular py-2 text-right text-muted">{pct(r.pickRate)}</td>
                <td className="tabular py-2 text-right text-muted">{pct(r.banRate)}</td>
                <td className="tabular py-2 pr-5 text-right text-faint">{r.games.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="py-12 text-center text-sm text-faint">{labels.noResults}</p>}
      </div>
    </div>
  );
}
