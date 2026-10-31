import type { ChampionDetail } from "@riftlens/db";
import { ddragonImg, isApex, type StaticData, type Tier } from "@riftlens/riot";
import { t, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { formatInt } from "@/lib/format";
import { pct1, Stat, wrColor } from "./ui";

// ---------------------------------------------------------------------------
// Tendencia: winrate, pick, partidas y ban por día

function Spark({ values, format, color, label }: { values: number[]; format: (v: number) => string; color: string; label: string }) {
  const W = 200;
  const H = 64;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (W - 8) + 4;
  const y = (v: number) => H - 6 - ((v - min) / span) * (H - 14);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1] ?? 0;
  return (
    <div className="rounded-xl border border-line bg-panel-2/40 p-3">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{label}</p>
        <p className="tabular text-sm font-semibold" style={{ color }}>
          {format(last)}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" aria-hidden>
        <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="1.6" fill={color} opacity={i === values.length - 1 ? 1 : 0.5} />
        ))}
      </svg>
      <div className="tabular flex justify-between text-[9px] text-faint">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export function Trends({ trend, dict }: { trend: ChampionDetail["trend"]; dict: Dictionary }) {
  const C = dict.champ;
  const raw = trend.filter((d) => d.matches > 0);
  if (raw.length < 3) return <p className="text-sm text-faint">{C.trendLow}</p>;
  // Media móvil de 3 días: con pocas partidas diarias, el dato de un solo día engaña
  const days = raw.map((d, i) => {
    const w = raw.slice(Math.max(0, i - 2), i + 1);
    const sum = (k: "games" | "wins" | "bans" | "matches") => w.reduce((s, x) => s + x[k], 0);
    return { day: d.day, games: sum("games") / w.length, wins: sum("wins"), bans: sum("bans"), matches: sum("matches"), gamesSum: sum("games") };
  });
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Spark label={dict.champions.winrate} values={days.map((d) => (d.gamesSum ? d.wins / d.gamesSum : 0))} format={pct1} color="var(--color-win)" />
        <Spark label={C.pickRateShort} values={days.map((d) => d.gamesSum / d.matches)} format={pct1} color="var(--color-accent)" />
        <Spark label={C.gamesShort} values={days.map((d) => d.games)} format={(v) => String(Math.round(v))} color="var(--color-fg)" />
        <Spark label={C.banRateShort} values={days.map((d) => d.bans / d.matches)} format={pct1} color="var(--color-loss)" />
      </div>
      <p className="mt-2 text-[11px] text-faint">
        {t(C.trendHelp, { n: days.length })} {days[0]!.day} → {days[days.length - 1]!.day} · {C.smoothed}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Habilidades por nivel

export function SkillLevels({ levels, dict }: { levels: ChampionDetail["skillLevels"]; dict: Dictionary }) {
  const C = dict.champ;
  const cols = levels.map((l, i) => ({ level: i + 1, total: l.q.games + l.w.games + l.e.games + l.r.games, l })).filter((c) => c.total > 0);
  const KEYS = [
    ["q", "Q", "126 166 255"],
    ["w", "W", "95 212 196"],
    ["e", "E", "246 165 96"],
    ["r", "R", "237 237 240"],
  ] as const;
  // Cuadrícula habilidad × nivel: la intensidad es el % de jugadores que la sube en ese nivel
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-[10px]">
        <thead>
          <tr>
            <th className="eyebrow pr-2 text-left font-medium">{C.level}</th>
            {cols.map((c) => (
              <th key={c.level} className="tabular w-9 font-normal text-faint">
                {c.level}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KEYS.map(([k, label, rgb]) => (
            <tr key={k}>
              <td className="pr-2 text-xs font-semibold" style={{ color: `rgb(${rgb})` }}>
                {label}
              </td>
              {cols.map(({ level, total, l }) => {
                const e = l[k];
                const share = total ? e.games / total : 0;
                const wr = e.games ? e.wins / e.games : 0;
                return (
                  <td
                    key={level}
                    className="tabular h-9 rounded text-center"
                    style={{ background: `rgb(${rgb} / ${Math.min(0.55, share * 0.6).toFixed(2)})`, color: share >= 0.5 ? "var(--color-bg)" : undefined }}
                    title={share ? `${Math.round(share * 100)}% · ${Math.round(wr * 100)}% WR · ${e.games}` : undefined}
                  >
                    {share >= 0.05 ? `${Math.round(share * 100)}` : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Runas en detalle: cada runa de las ramas usadas, con winrate y frecuencia

export function RuneStats({ stats, data, total }: { stats: ChampionDetail["runeStats"]; data: StaticData; total: number }) {
  const used = data.runeTrees.filter((tree) => tree.slots.flat().some((id) => (stats[String(id)]?.games ?? 0) / total >= 0.01));
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {used.map((tree) => (
        <div key={tree.id} className="rounded-xl border border-line bg-panel-2/30 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ddragonImg.rune(tree.icon)} alt="" width={16} height={16} />
            {tree.name}
          </p>
          <div className="space-y-2">
            {tree.slots.map((row, i) => (
              <div key={i} className="flex gap-1.5">
                {row.map((id) => {
                  const e = stats[String(id)] ?? { games: 0, wins: 0 };
                  const r = data.runes[id];
                  const share = e.games / total;
                  return (
                    <div key={id} className={`flex-1 rounded-lg p-1 text-center ${share >= 0.01 ? "" : "opacity-30"}`} title={r?.name}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r && <img src={ddragonImg.rune(r.icon)} alt={r.name} width={i === 0 ? 30 : 24} height={i === 0 ? 30 : 24} className="mx-auto rounded-full" />}
                      <p className="tabular mt-0.5 text-[10px] font-medium" style={{ color: e.games ? wrColor(e.wins / e.games) : undefined }}>
                        {e.games ? `${Math.round((e.wins / e.games) * 100)}%` : "—"}
                      </p>
                      <p className="tabular text-[9px] text-faint">{share >= 0.001 ? `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%` : ""}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra lateral: objetivos, duración, base de jugadores, estadísticas, mejores jugadores

export function Objectives({ detail, dict, total }: { detail: ChampionDetail; dict: Dictionary; total: number }) {
  const C = dict.champ;
  const K = C.objectiveKeys;
  const cell = (e: { games: number; wins: number }) => (
    <>
      <td className="tabular py-1.5 text-right text-muted">{total ? pct1(e.games / total) : "—"}</td>
      <td className="tabular py-1.5 pl-2 text-right font-medium" style={{ color: e.games ? wrColor(e.wins / e.games) : undefined }}>
        {e.games ? pct1(e.wins / e.games) : "—"}
      </td>
    </>
  );
  return (
    <table className="w-full text-xs">
      <thead>
        <tr>
          <th />
          <th colSpan={2} className="eyebrow pb-1 text-right font-medium text-win/80">
            {C.secure}
          </th>
          <th colSpan={2} className="eyebrow pb-1 text-right font-medium text-loss/80">
            {C.yield}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t border-line">
          <td className="py-1.5">{K.blue}</td>
          {cell(detail.sides.blue)}
          <td colSpan={2} />
        </tr>
        <tr className="border-t border-line">
          <td className="py-1.5">{K.red}</td>
          {cell(detail.sides.red)}
          <td colSpan={2} />
        </tr>
        {detail.objectives.map((o) => (
          <tr key={o.key} className="border-t border-line">
            <td className="py-1.5">{K[o.key as keyof typeof K] ?? o.key}</td>
            {cell(o.secure)}
            {cell(o.yield)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Duration({ duration, dict }: { duration: ChampionDetail["duration"]; dict: Dictionary }) {
  const C = dict.champ;
  const total = duration.reduce((s, d) => s + d.games, 0) || 1;
  const maxShare = Math.max(...duration.map((d) => d.games / total), 0.01);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {duration.map((d) => {
          const wr = d.games ? d.wins / d.games : 0;
          return (
            <div key={d.bucket} className="flex h-full flex-1 flex-col justify-end" title={`${d.bucket} ${C.minutes}: ${d.games}`}>
              <p className="tabular mb-1 text-center text-[10px] font-medium" style={{ color: d.games ? wrColor(wr) : undefined }}>
                {d.games >= 3 ? `${Math.round(wr * 100)}%` : ""}
              </p>
              <div className="rounded-t-md bg-fg/20" style={{ height: `${(d.games / total / maxShare) * 70}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {duration.map((d) => (
          <p key={d.bucket} className="tabular flex-1 text-center text-[9px] text-faint">
            {d.bucket}
          </p>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-faint">
        {C.durationWr} · {C.durationDist} ({C.minutes})
      </p>
    </div>
  );
}

export function PlayerBase({ base, dict }: { base: ChampionDetail["playerBase"]; dict: Dictionary }) {
  const C = dict.champ;
  const Q = C.quadrants;
  // Escala logarítmica centrada en 1 (la media): de 0.25× a 4×
  const pos = (v: number) => Math.min(96, Math.max(4, 50 + (Math.log2(Math.max(v, 0.01)) / 2) * 50));
  return (
    <div>
      <div className="relative aspect-square rounded-xl border border-line bg-panel-2/30 text-[10px] text-faint">
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
        <span className="absolute left-2 top-2">{Q.niche}</span>
        <span className="absolute right-2 top-2">{Q.popular}</span>
        <span className="absolute bottom-2 left-2">{Q.unpopular}</span>
        <span className="absolute bottom-2 right-2">{Q.broad}</span>
        <span
          className="absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_4px_rgb(142_230_208/0.2)]"
          style={{ left: `${pos(base.popularity)}%`, bottom: `${pos(base.depth)}%` }}
        />
      </div>
      <p className="tabular mt-2 flex justify-between text-[10px] text-faint">
        <span>
          {C.popularity} ×{base.popularity.toFixed(2)}
        </span>
        <span>
          {C.depth} ×{base.depth.toFixed(2)}
        </span>
      </p>
    </div>
  );
}

export function Stats({ stats, dict, locale }: { stats: ChampionDetail["stats"]; dict: Dictionary; locale: Locale }) {
  const K = dict.champ.statKeys;
  const order = Object.keys(K) as (keyof typeof K)[];
  return (
    <dl className="divide-y divide-line text-xs">
      {order
        .filter((k) => stats[k])
        .map((k) => {
          const s = stats[k]!;
          return (
            <div key={k} className="flex items-center justify-between gap-3 py-1.5">
              <dt className="text-muted">{K[k]}</dt>
              <dd className="tabular flex items-baseline gap-2">
                <span className="font-medium">{s.value >= 100 ? formatInt(Math.round(s.value), locale) : s.value.toFixed(2)}</span>
                <span className="w-12 text-right text-[10px] text-faint">
                  {s.rank}/{s.of}
                </span>
              </dd>
            </div>
          );
        })}
    </dl>
  );
}

export function BestPlayers({ players, dict, hrefFor }: { players: ChampionDetail["bestPlayers"]; dict: Dictionary; hrefFor: (name: string, tag: string) => string }) {
  if (!players.length) return <p className="text-sm text-faint">{dict.champ.noPlayers}</p>;
  return (
    <ol className="space-y-1">
      {players.map((p, i) => (
        <li key={`${p.gameName}#${p.tagLine}`} className="flex items-center gap-2 text-xs">
          <span className="tabular w-4 text-faint">{i + 1}</span>
          <a href={hrefFor(p.gameName, p.tagLine)} className="min-w-0 flex-1 truncate hover:text-accent">
            {p.gameName}
            <span className="text-faint">#{p.tagLine}</span>
          </a>
          {p.tier && (
            <span className="text-[10px] text-faint">
              {dict.tiers[p.tier as Tier] ?? p.tier}
              {isApex(p.tier) ? "" : ""}
            </span>
          )}
          <Stat e={p} />
        </li>
      ))}
    </ol>
  );
}
