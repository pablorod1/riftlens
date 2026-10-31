import type { ProfileMatch } from "@riftlens/core";
import { kda } from "@riftlens/core";
import { POSITION_LABELS, type Position } from "@riftlens/riot";
import Image from "next/image";
import { positionIcon } from "@/lib/assets";
import { fmtKda, pct } from "@/lib/format";

/** Resumen de las últimas partidas (sin remakes). */
export function RecentSummary({ matches }: { matches: ProfileMatch[] }) {
  const valid = matches.filter((m) => !m.match.remake);
  if (!valid.length) return null;
  const wins = valid.filter((m) => m.me.win).length;
  const sum = valid.reduce(
    (s, m) => {
      const teamKills = m.participants.filter((p) => p.teamId === m.me.teamId).reduce((a, p) => a + p.kills, 0);
      s.k += m.me.kills;
      s.d += m.me.deaths;
      s.a += m.me.assists;
      s.kp += teamKills ? (m.me.kills + m.me.assists) / teamKills : 0;
      return s;
    },
    { k: 0, d: 0, a: 0, kp: 0 },
  );
  const n = valid.length;
  const positions = new Map<string, number>();
  for (const m of valid) if (m.me.position) positions.set(m.me.position, (positions.get(m.me.position) ?? 0) + 1);
  const topPositions = [...positions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);

  const wr = wins / n;
  const r = 30;
  const c = 2 * Math.PI * r;

  return (
    <section className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center gap-3">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-label={`Winrate ${pct(wr)}`}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-loss)" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={r} fill="none" stroke="var(--color-win)" strokeWidth="7"
            strokeDasharray={`${wr * c} ${c}`} transform="rotate(-90 36 36)"
          />
          <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-fg)">
            {pct(wr)}
          </text>
        </svg>
        <div className="text-sm">
          <p className="text-xs uppercase tracking-wider text-muted">Últimas {n}</p>
          <p className="tabular">
            {wins}V {n - wins}D
          </p>
        </div>
      </div>
      <div className="tabular text-sm">
        <p>
          {(sum.k / n).toFixed(1)} / <span className="text-loss">{(sum.d / n).toFixed(1)}</span> / {(sum.a / n).toFixed(1)}
        </p>
        <p className="text-lg font-bold">{fmtKda(kda(sum.k, sum.d, sum.a))} KDA</p>
        <p className="text-xs text-muted">P/Kill {pct(sum.kp / n)}</p>
      </div>
      {topPositions.length > 0 && (
        <div className="flex gap-4">
          {topPositions.map(([pos, count]) => {
            const icon = positionIcon(pos);
            return (
              <div key={pos} className="flex items-center gap-2 text-sm">
                {icon && <Image src={icon} alt="" width={22} height={22} />}
                <div>
                  <p>{POSITION_LABELS[pos as Position] ?? pos}</p>
                  <p className="tabular text-xs text-muted">{pct(count / n)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
