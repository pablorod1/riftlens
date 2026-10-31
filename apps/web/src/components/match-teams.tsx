import type { ProfileMatch } from "@riftlens/core";
import type { MatchParticipant } from "@riftlens/db";
import type { StaticData } from "@riftlens/riot";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { formatInt } from "@/lib/format";
import { ChampionIcon } from "./icons";

type Metric = keyof Dictionary["matchDetails"]["charts"];
const VALUE: Record<Metric, (p: MatchParticipant) => number> = {
  kills: (p) => p.kills,
  gold: (p) => p.gold,
  damage: (p) => p.damage,
  wards: (p) => p.wardsPlaced ?? 0,
  taken: (p) => p.damageTaken,
  cs: (p) => p.cs,
};

function Donut({ a, b, locale }: { a: number; b: number; locale: Locale }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const share = a + b ? a / (a + b) : 0.5;
  return (
    <svg viewBox="0 0 88 88" className="size-24 shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-loss)" strokeWidth="7" opacity="0.8" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-win)" strokeWidth="7" strokeDasharray={`${share * c} ${c}`} transform="rotate(-90 44 44)" />
      <text x="44" y="41" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-win)" className="tabular">
        {formatInt(a, locale)}
      </text>
      <line x1="30" x2="58" y1="46" y2="46" stroke="var(--color-line-strong)" />
      <text x="44" y="58" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-loss)" className="tabular">
        {formatInt(b, locale)}
      </text>
    </svg>
  );
}

/** Comparativa por equipos (todo con datos guardados). */
export function MatchTeams({ m, data, dict, locale }: { m: ProfileMatch; data: StaticData; dict: Dictionary; locale: Locale }) {
  const D = dict.matchDetails;
  const teams = [100, 200].map((id) => m.participants.filter((p) => p.teamId === id));
  const hasWards = m.participants.some((p) => (p.wardsPlaced ?? 0) > 0);
  const metrics = (Object.keys(VALUE) as Metric[]).filter((k) => k !== "wards" || hasWards);

  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
      {metrics.map((metric) => {
        const value = VALUE[metric];
        const max = Math.max(1, ...m.participants.map(value));
        const sums = teams.map((team) => team.reduce((s, p) => s + value(p), 0));
        const column = (team: MatchParticipant[], color: string) => (
          <ul className="min-w-0 flex-1 space-y-1.5">
            {team.map((p) => (
              <li key={p.puuid} className="flex items-center gap-1.5">
                <ChampionIcon data={data} championId={p.championId} size={18} className={`rounded ${p.puuid === m.me.puuid ? "ring-1 ring-fg" : ""}`} />
                <span className="relative h-4 flex-1 overflow-hidden rounded bg-panel-3">
                  <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(value(p) / max) * 100}%`, background: color, opacity: 0.75 }} />
                  <span className="tabular absolute inset-y-0 right-1.5 flex items-center text-[10px]">{formatInt(value(p), locale)}</span>
                </span>
              </li>
            ))}
          </ul>
        );
        return (
          <section key={metric}>
            <h3 className="eyebrow mb-3 text-center">{D.charts[metric]}</h3>
            <div className="flex items-center gap-3">
              {column(teams[0]!, "var(--color-win)")}
              <Donut a={sums[0]!} b={sums[1]!} locale={locale} />
              {column(teams[1]!, "var(--color-loss)")}
            </div>
          </section>
        );
      })}
    </div>
  );
}
