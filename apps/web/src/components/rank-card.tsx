import type { LeagueEntry } from "@riftlens/db";
import { isApex, type Tier } from "@riftlens/riot";
import Image from "next/image";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { rankEmblem } from "@/lib/assets";
import { pct } from "@/lib/format";

export const rankLabel = (entry: LeagueEntry, dict: Dictionary) =>
  `${dict.tiers[entry.tier as Tier] ?? entry.tier}${isApex(entry.tier) ? "" : ` ${entry.division}`}`;

function RankRow({ title, entry, dict }: { title: string; entry?: LeagueEntry; dict: Dictionary }) {
  if (!entry) {
    return (
      <div className="flex items-center justify-between py-4">
        <p className="eyebrow">{title}</p>
        <p className="text-sm text-faint">{dict.profile.unranked}</p>
      </div>
    );
  }
  const games = entry.wins + entry.losses;
  const wr = games ? entry.wins / games : 0;
  return (
    <div className="py-4">
      <p className="eyebrow">{title}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center">
          <Image src={rankEmblem(entry.tier)} alt="" width={56} height={56} className="scale-[2.5] drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold tracking-tight">{rankLabel(entry, dict)}</p>
          <p className="tabular text-xs text-muted">{t(dict.profile.lp, { lp: entry.leaguePoints })}</p>
        </div>
        <div className="text-right">
          <p className="tabular text-sm font-medium" style={{ color: wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)" }}>
            {pct(wr)}
          </p>
          <p className="tabular text-xs text-faint">{t(dict.profile.winsLosses, { w: entry.wins, l: entry.losses })}</p>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-loss/25">
        <div className="h-full rounded-full bg-win/80" style={{ width: `${wr * 100}%` }} />
      </div>
    </div>
  );
}

export function RankPanel({ solo, flex, dict }: { solo?: LeagueEntry; flex?: LeagueEntry; dict: Dictionary }) {
  return (
    <section className="divide-y divide-line rounded-2xl border border-line bg-panel px-5">
      <RankRow title={dict.profile.soloQueue} entry={solo} dict={dict} />
      <RankRow title={dict.profile.flexQueue} entry={flex} dict={dict} />
    </section>
  );
}
