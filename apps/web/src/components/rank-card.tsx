import type { LeagueEntry } from "@riftlens/db";
import { isApex, type Tier } from "@riftlens/riot";
import Image from "next/image";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { rankEmblem } from "@/lib/assets";
import { pct } from "@/lib/format";

export function RankCard({ title, entry, dict }: { title: string; entry?: LeagueEntry; dict: Dictionary }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {entry ? (
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center">
            <Image src={rankEmblem(entry.tier)} alt="" width={64} height={64} className="scale-[2.6]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">
              {dict.tiers[entry.tier as Tier] ?? entry.tier} {isApex(entry.tier) ? "" : entry.division}
            </p>
            <p className="tabular text-sm text-muted">{t(dict.profile.lp, { lp: entry.leaguePoints })}</p>
          </div>
          <div className="tabular text-right text-sm">
            <p className="text-muted">{t(dict.profile.winsLosses, { w: entry.wins, l: entry.losses })}</p>
            <p className="font-semibold">{pct(entry.wins / Math.max(1, entry.wins + entry.losses))}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-faint">{dict.profile.unranked}</p>
      )}
    </section>
  );
}
