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
    <section className="rounded-2xl border border-line bg-panel">
      <header className="flex items-baseline justify-between gap-2 px-5 pt-4 pb-2">
        <h2 className="eyebrow">{p.champions}</h2>
      </header>
      {champions.length === 0 ? (
        <p className="px-5 pt-2 pb-5 text-sm text-faint">{p.noRanked}</p>
      ) : (
        <ul className="px-2 pb-2">
          {champions.slice(0, 8).map((c) => (
            <li key={c.championId} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-panel-2">
              <ChampionIcon data={data} championId={c.championId} size={34} className="rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{data.champions[c.championId]?.name ?? "?"}</p>
                <p className="tabular text-[11px] text-faint">
                  {t(p.kda, { kda: fmtKda(kda(c.kills, c.deaths, c.assists), p.perfect) })} ·{" "}
                  {t(p.csMin, { cs: (c.cs / (c.seconds / 60)).toFixed(1) })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Winrate wins={c.wins} games={c.games} dict={dict} />
                <span className="tabular text-[10px] text-faint">{t(p.games, { n: c.games })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line px-5 py-3 text-[11px] leading-snug text-faint">{t(p.ciNote, { n: SMALL_SAMPLE })}</p>
    </section>
  );
}
