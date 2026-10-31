import type { LeagueEntry } from "@riftlens/db";
import { isApex, TIER_LABELS, type Tier } from "@riftlens/riot";
import Image from "next/image";
import { rankEmblem } from "@/lib/assets";
import { pct } from "@/lib/format";

export function RankCard({ title, entry }: { title: string; entry?: LeagueEntry }) {
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
              {TIER_LABELS[entry.tier as Tier] ?? entry.tier} {isApex(entry.tier) ? "" : entry.division}
            </p>
            <p className="tabular text-sm text-muted">{entry.leaguePoints} LP</p>
          </div>
          <div className="tabular text-right text-sm">
            <p className="text-muted">
              {entry.wins}V {entry.losses}D
            </p>
            <p className="font-semibold">{pct(entry.wins / Math.max(1, entry.wins + entry.losses))}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-faint">Sin clasificar</p>
      )}
    </section>
  );
}
