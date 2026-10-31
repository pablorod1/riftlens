import type { Position, StaticData } from "@riftlens/riot";
import Image from "next/image";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { positionIcon } from "@/lib/assets";
import { pct } from "@/lib/format";
import type { Insights } from "@/lib/insights";
import { ChampionIcon } from "./icons";

function Tile({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-panel px-5 py-4">
      <p className="eyebrow">{label}</p>
      <div className="mt-2 flex items-center gap-2.5 text-[15px] font-medium tracking-tight">{children}</div>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}

/** Cuatro lecturas en lenguaje natural: lo primero que uno quiere saber de un perfil. */
export function InsightsRow({ insights, data, dict }: { insights: Insights; data: StaticData; dict: Dictionary }) {
  const p = dict.profile;
  const { streak, best, mainRole, csPerMin } = insights;
  const roleIcon = mainRole ? positionIcon(mainRole.position) : null;
  return (
    <section aria-label={p.insights} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      <Tile label={p.streak}>
        {streak ? (
          <>
            <span className="size-2 rounded-full" style={{ background: streak > 0 ? "var(--color-win)" : "var(--color-loss)" }} />
            {t(streak > 0 ? p.streakWin : p.streakLoss, { n: Math.abs(streak) })}
          </>
        ) : (
          <span className="text-muted">{p.streakNone}</span>
        )}
      </Tile>
      <Tile label={p.bestChampion} sub={best ? t(p.bestChampionValue, { wr: pct(best.wins / best.games), n: best.games }) : undefined}>
        {best ? (
          <>
            <ChampionIcon data={data} championId={best.championId} size={22} className="rounded-md" />
            <span className="truncate">{data.champions[best.championId]?.name}</span>
          </>
        ) : (
          <span className="text-muted">{p.noData}</span>
        )}
      </Tile>
      <Tile label={p.mainRole} sub={mainRole ? t(p.mainRoleValue, { pct: pct(mainRole.share) }) : undefined}>
        {mainRole ? (
          <>
            {roleIcon && <Image src={roleIcon} alt="" width={18} height={18} className="opacity-80" />}
            {dict.positions[mainRole.position as Position] ?? mainRole.position}
          </>
        ) : (
          <span className="text-muted">{p.noData}</span>
        )}
      </Tile>
      <Tile label={p.farming} sub={csPerMin !== null ? p.farmingValue : undefined}>
        {csPerMin !== null ? <span className="tabular">{csPerMin.toFixed(1)}</span> : <span className="text-muted">{p.noData}</span>}
      </Tile>
    </section>
  );
}
