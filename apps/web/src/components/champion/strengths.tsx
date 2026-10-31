import { ddragonImg, type Position, type StaticData } from "@riftlens/riot";
import Link from "next/link";
import { localePath, t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { positionIcon } from "@/lib/assets";
import { championSlug } from "@/lib/champions";
import { delta2 } from "./lab-data";
import type { LabRow } from "./matchup-lab";
import { pct1, wrColor } from "./ui";

/** Cuatro listas rápidas: fuerte/débil en línea, mejores aliados y amenazas de otras posiciones. */
export function Strengths({
  rows,
  champWr,
  totalGames,
  position,
  data,
  dict,
  locale,
  vsBase,
  vsQuery,
  bracketQuery,
}: {
  rows: LabRow[];
  champWr: number;
  totalGames: number;
  position: string;
  data: StaticData;
  dict: Dictionary;
  locale: Locale;
  vsBase: string;
  vsQuery: string;
  bracketQuery: string;
}) {
  const L = dict.lab;
  const min = Math.max(5, Math.round(totalGames * 0.01));
  const solid = rows.filter((r) => r.games >= min);
  const lane = solid.filter((r) => r.side === "enemy" && r.position === position);
  const by = (list: LabRow[], dir: 1 | -1) => [...list].sort((a, b) => (delta2(a, champWr) - delta2(b, champWr)) * dir);
  const blocks = [
    { title: L.strongVs, list: by(lane, -1).filter((r) => delta2(r, champWr) > 0), tone: "win" as const },
    { title: L.weakVs, list: by(lane, 1).filter((r) => delta2(r, champWr) < 0), tone: "loss" as const },
    { title: L.bestAllies, list: by(solid.filter((r) => r.side === "ally"), -1).filter((r) => delta2(r, champWr) > 0), tone: "win" as const },
    { title: L.threats, list: by(solid.filter((r) => r.side === "enemy" && r.position !== position), 1).filter((r) => delta2(r, champWr) < 0), tone: "loss" as const },
  ];

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="eyebrow" title={t(L.strengthsHelp, { n: min })}>
        {L.strengths}
        <span className="ml-1 cursor-help text-faint/70">ⓘ</span>
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {blocks.map((b) => (
          <div key={b.title} className="rounded-xl border border-line bg-panel-2/30 p-3">
            <p className={`mb-2 flex items-center gap-2 text-xs font-medium ${b.tone === "win" ? "text-win" : "text-loss"}`}>
              <span className={`size-1.5 rounded-full ${b.tone === "win" ? "bg-win" : "bg-loss"}`} />
              {b.title}
            </p>
            {b.list.length === 0 ? (
              <p className="py-4 text-xs text-faint">{L.none}</p>
            ) : (
              <ol className="space-y-0.5">
                {b.list.slice(0, 5).map((r) => {
                  const c = data.champions[r.championId];
                  if (!c) return null;
                  const isLane = r.side === "enemy" && r.position === position;
                  const slug = championSlug(data, r.championId);
                  const href = isLane ? `${vsBase}${slug}${vsQuery}` : localePath(locale, `/champions/${slug}${bracketQuery}`);
                  const d = delta2(r, champWr);
                  const icon = r.position !== position || r.side === "ally" ? positionIcon(r.position) : null;
                  return (
                    <li key={`${r.side}-${r.position}-${r.championId}`}>
                      <Link href={href} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-panel-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ddragonImg.champion(data.version, c.id)} alt="" width={28} height={28} className="rounded-md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{c.name}</span>
                          <span className="tabular flex items-center gap-1 text-[10px] text-faint">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {icon && <img src={icon} alt="" width={10} height={10} className="opacity-60" />}
                            {icon ? `${dict.positions[r.position as Position] ?? r.position} · ` : ""}
                            {t(dict.champions.gamesN, { n: r.games })}
                          </span>
                        </span>
                        <span className="tabular text-right">
                          <span className="block text-sm font-medium" style={{ color: wrColor(r.wins / r.games) }}>
                            {pct1(r.wins / r.games)}
                          </span>
                          <span className="block text-[10px]" style={{ color: d >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>
                            Δ2 {d >= 0 ? "+" : "−"}
                            {Math.abs(d * 100).toFixed(1)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
