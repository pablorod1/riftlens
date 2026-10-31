import type { ProfileMatch } from "@riftlens/core";
import { kda } from "@riftlens/core";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { fmtKda, pct } from "@/lib/format";

/** Tira de forma: las últimas partidas de izquierda (antigua) a derecha (reciente). */
export function FormStrip({ matches, dict }: { matches: ProfileMatch[]; dict: Dictionary }) {
  const p = dict.profile;
  const valid = matches.filter((m) => !m.match.remake);
  if (!valid.length) return null;
  const wins = valid.filter((m) => m.me.win).length;
  const n = valid.length;
  const k = valid.reduce((s, m) => s + m.me.kills, 0);
  const d = valid.reduce((s, m) => s + m.me.deaths, 0);
  const a = valid.reduce((s, m) => s + m.me.assists, 0);
  const kp =
    valid.reduce((s, m) => {
      const teamKills = m.participants.filter((x) => x.teamId === m.me.teamId).reduce((sum, x) => sum + x.kills, 0);
      return s + (teamKills ? (m.me.kills + m.me.assists) / teamKills : 0);
    }, 0) / n;
  const wr = wins / n;

  return (
    <section className="rounded-2xl border border-line bg-panel px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="eyebrow">
            {p.form} · {t(p.last, { n })}
          </p>
          <p className="mt-2 flex items-baseline gap-3">
            <span className="tabular text-2xl font-semibold" style={{ color: wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)" }}>
              {pct(wr)}
            </span>
            <span className="tabular text-sm text-muted">{t(p.winsLosses, { w: wins, l: n - wins })}</span>
          </p>
        </div>
        <dl className="flex gap-8 text-right">
          <div>
            <dt className="eyebrow">KDA</dt>
            <dd className="tabular mt-2 text-sm">
              <span className="font-semibold">{fmtKda(kda(k, d, a), p.perfect)}</span>
              <span className="ml-2 text-faint">
                {(k / n).toFixed(1)}/{(d / n).toFixed(1)}/{(a / n).toFixed(1)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">KP</dt>
            <dd className="tabular mt-2 text-sm font-semibold">{pct(kp)}</dd>
          </div>
        </dl>
      </div>
      <ol className="mt-4 flex gap-1" aria-label={p.form}>
        {[...valid].reverse().map((m) => (
          <li
            key={m.match.matchId}
            title={m.me.win ? p.victory : p.defeat}
            className="h-5 flex-1 rounded-[3px]"
            style={{ background: m.me.win ? "var(--color-win)" : "var(--color-loss)", opacity: m.me.win ? 0.85 : 0.55 }}
          />
        ))}
      </ol>
    </section>
  );
}
