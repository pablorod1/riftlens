"use client";

import Link from "next/link";
import { useState } from "react";
import { normChampion } from "@/lib/champion-search";

export interface GridChampion {
  slug: string;
  name: string;
  icon: string;
  href: string;
  /** Posiciones en las que se juega (de más a menos partidas) */
  roles: string[];
}

/** Rejilla de todos los campeones con filtro por nombre y por rol. */
export function ChampionGrid({
  champions,
  positions,
  labels,
}: {
  champions: GridChampion[];
  positions: { key: string; label: string; icon: string | null }[];
  labels: { filter: string; all: string; none: string };
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const nq = normChampion(q);
  const list = champions.filter((c) => (!nq || normChampion(c.name).includes(nq)) && (!role || c.roles.includes(role)));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="tablist" className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-xl border border-line bg-panel p-1">
          {[{ key: null as string | null, label: labels.all, icon: null as string | null }, ...positions].map((p) => (
            <button
              key={p.key ?? "all"}
              type="button"
              role="tab"
              aria-selected={role === p.key}
              onClick={() => setRole(p.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                role === p.key ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.icon && <img src={p.icon} alt="" width={14} height={14} className={role === p.key ? "opacity-90" : "opacity-50"} />}
              {p.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.filter}
          aria-label={labels.filter}
          className="h-9 w-44 rounded-lg border border-line bg-panel px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong"
        />
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-faint">{labels.none}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-x-2 gap-y-3">
          {list.map((c) => (
            <li key={c.slug}>
              <Link href={c.href} className="group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-colors hover:bg-panel-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.icon}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  className="size-12 rounded-xl ring-1 ring-line transition-transform group-hover:scale-105 group-hover:ring-line-strong"
                />
                <span className="w-full truncate text-center text-[11px] text-muted group-hover:text-fg">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
