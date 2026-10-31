"use client";

import { type ReactNode, useState } from "react";
import type { QueueGroup } from "@/lib/insights";

type Filter = "all" | QueueGroup;

/** Filtro instantáneo por cola sobre partidas ya renderizadas en el servidor. */
export function MatchList({
  items,
  labels,
}: {
  items: { id: string; group: QueueGroup; node: ReactNode }[];
  labels: { all: string; solo: string; flex: string; other: string; empty: string; title: string };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = { all: items.length, solo: 0, flex: 0, other: 0 } as Record<Filter, number>;
  for (const i of items) counts[i.group]++;
  const tabs = (["all", "solo", "flex", "other"] as Filter[]).filter((f) => f === "all" || counts[f] > 0);
  const visible = filter === "all" ? items : items.filter((i) => i.group === filter);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="eyebrow">{labels.title}</h2>
        <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-line bg-panel p-0.5">
          {tabs.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                filter === f ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"
              }`}
            >
              {labels[f]}
              <span className="tabular text-[10px] text-faint">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {visible.map((i) => (
          <div key={i.id} className="animate-fade-up">
            {i.node}
          </div>
        ))}
        {visible.length === 0 && <p className="py-10 text-center text-sm text-faint">{labels.empty}</p>}
      </div>
    </section>
  );
}
