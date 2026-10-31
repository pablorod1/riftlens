import { kda, SMALL_SAMPLE, type ChampionSummary } from "@riftlens/core";
import type { StaticData } from "@riftlens/riot";
import { fmtKda } from "@/lib/format";
import { ChampionIcon } from "./icons";
import { Winrate } from "./winrate";

export function ChampionStats({ data, champions }: { data: StaticData; champions: ChampionSummary[] }) {
  return (
    <section className="rounded-xl border border-line bg-panel">
      <header className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Campeones en clasificatoria</h2>
        <span className="text-[11px] text-faint">partidas guardadas</span>
      </header>
      {champions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-faint">Sin partidas clasificatorias recientes.</p>
      ) : (
        <ul className="divide-y divide-line">
          {champions.slice(0, 10).map((c) => {
            const ratio = kda(c.kills, c.deaths, c.assists);
            return (
              <li key={c.championId} className="flex items-center gap-3 px-4 py-2.5">
                <ChampionIcon data={data} championId={c.championId} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{data.champions[c.championId]?.name ?? "?"}</p>
                  <p className="tabular text-xs text-muted">
                    {(c.cs / (c.seconds / 60)).toFixed(1)} CS/min · {fmtKda(ratio)} KDA
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <Winrate wins={c.wins} games={c.games} />
                  <span className="tabular text-[11px] text-faint">{c.games} partidas</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-line px-4 py-2 text-[11px] leading-snug text-faint">
        La barra marca el rango probable del winrate real. Con menos de {SMALL_SAMPLE} partidas aparece el margen de error (±).
      </p>
    </section>
  );
}
