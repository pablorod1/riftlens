"use client";

import { type ReactNode, useState, useTransition } from "react";
import { loadMatchTimeline, type MatchTimelinePayload } from "@/app/actions";
import { BuildView } from "./match/build-view";
import { GraphsView } from "./match/graphs-view";
import { TimelineView } from "./match/timeline-view";
import type { DetailLabels, PlayerMeta } from "./match/types";

type Tab = "overview" | "teams" | "timeline" | "build" | "graphs";
const NEEDS_TIMELINE: Tab[] = ["timeline", "build", "graphs"];

/**
 * Pestañas del detalle de una partida. Resumen y Equipos llegan ya renderizados
 * desde el servidor; Timeline, Build y Gráficas cargan la línea temporal la
 * primera vez que se abren (1 petición a Riot, luego queda guardada).
 */
export function MatchDetails({
  overview,
  teams,
  matchId,
  region,
  lang,
  me,
  players,
  labels,
}: {
  overview: ReactNode;
  teams: ReactNode;
  matchId: string;
  region: string;
  lang: string;
  me: string;
  players: PlayerMeta[];
  labels: DetailLabels;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [payload, setPayload] = useState<MatchTimelinePayload | null>(null);
  const [pending, start] = useTransition();

  const load = () => start(async () => setPayload(await loadMatchTimeline({ matchId, puuid: me, region, lang })));
  const open = (next: Tab) => {
    setTab(next);
    if (NEEDS_TIMELINE.includes(next) && !payload?.ok && !pending) load();
  };

  const tabs: Tab[] = ["overview", "teams", "timeline", "build", "graphs"];
  const needs = NEEDS_TIMELINE.includes(tab);

  return (
    <div>
      <div role="tablist" className="no-scrollbar flex gap-5 overflow-x-auto border-b border-line px-5">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => open(t)}
            className={`-mb-px shrink-0 border-b-2 py-3 text-xs font-medium transition-colors ${
              tab === t ? "border-fg text-fg" : "border-transparent text-faint hover:text-muted"
            }`}
          >
            {labels.d.tabs[t]}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        {tab === "overview" && overview}
        {tab === "teams" && <div className="p-2">{teams}</div>}
        {needs && (pending || !payload) && (
          <div className="space-y-3 p-2" aria-busy="true">
            <div className="skeleton h-40 rounded-xl" />
            <p className="text-center text-xs text-faint">{labels.d.loading}</p>
          </div>
        )}
        {needs && !pending && payload && !payload.ok && (
          <div className="flex flex-col items-center gap-3 py-10 text-sm">
            <p className="text-loss">{payload.message}</p>
            <button type="button" onClick={load} className="rounded-lg border border-line-strong px-3 py-1.5 text-xs hover:border-accent/50">
              {labels.d.retry}
            </button>
          </div>
        )}
        {needs && !pending && payload?.ok && payload.timeline && (
          <>
            {tab === "timeline" && <TimelineView data={payload} players={players} labels={labels} />}
            {tab === "build" && <BuildView data={payload} players={players} me={me} labels={labels} />}
            {tab === "graphs" && <GraphsView data={payload} players={players} me={me} labels={labels} />}
          </>
        )}
      </div>
    </div>
  );
}
