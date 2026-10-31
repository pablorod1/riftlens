import { kda, SMALL_SAMPLE, type ChampionSummary } from "@riftlens/core";
import type { StaticData } from "@riftlens/riot";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { fmtKda } from "@/lib/format";
import { ChampionIcon } from "./icons";
import { Winrate } from "./winrate";

export function ChampionStats({ data, champions, dict }: { data: StaticData; champions: ChampionSummary[]; dict: Dictionary }) {
  const p = dict.profile;
  return (
    <section className="rounded-xl border border-line bg-panel">
      <header className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{p.champions}</h2>
        <span className="text-[11px] text-faint">{p.savedGames}</span>
      </header>
      {champions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-faint">{p.noRanked}</p>
      ) : (
        <ul className="divide-y divide-line">
          {champions.slice(0, 10).map((c) => (
            <li key={c.championId} className="flex items-center gap-3 px-4 py-2.5">
              <ChampionIcon data={data} championId={c.championId} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{data.champions[c.championId]?.name ?? "?"}</p>
                <p className="tabular text-xs text-muted">
                  {t(p.csMin, { cs: (c.cs / (c.seconds / 60)).toFixed(1) })} ·{" "}
                  {t(p.kda, { kda: fmtKda(kda(c.kills, c.deaths, c.assists), p.perfect) })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <Winrate wins={c.wins} games={c.games} dict={dict} />
                <span className="tabular text-[11px] text-faint">{t(p.games, { n: c.games })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line px-4 py-2 text-[11px] leading-snug text-faint">{t(p.ciNote, { n: SMALL_SAMPLE })}</p>
    </section>
  );
}
