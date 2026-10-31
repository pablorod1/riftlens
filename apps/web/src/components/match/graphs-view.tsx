"use client";

import { useState } from "react";
import type { MatchTimelinePayload } from "@/app/actions";
import { PlayerPicker } from "./player-picker";
import { PLAYER_COLORS, type DetailLabels, type PlayerMeta } from "./types";

type Metric = "gold" | "xp" | "cs";
const W = 720;
const H = 240;
const PAD = { l: 40, r: 12, t: 12, b: 22 };
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString()}`;

/**
 * Curvas por minuto de los jugadores elegidos. Para el jugador del perfil se
 * puede superponer la mediana de alto elo de su campeón y rol (oro y CS).
 */
export function GraphsView({ data, players, me, labels }: { data: MatchTimelinePayload; players: PlayerMeta[]; me: string; labels: DetailLabels }) {
  const tl = data.timeline!;
  const D = labels.d;
  const A = labels.a;
  const mine = players.find((p) => p.puuid === me);
  const opp = mine ? players.find((p) => p.teamId !== mine.teamId && p.position === mine.position && p.position) : undefined;
  const [metric, setMetric] = useState<Metric>("gold");
  const [selected, setSelected] = useState<number[]>([mine?.participantId, opp?.participantId].filter((x): x is number => !!x));
  const [showRef, setShowRef] = useState(true);

  // Las líneas temporales empiezan en el minuto 0; las curvas de referencia, en el 1
  const series = selected.map((pid) => ({ pid, data: tl.frames[pid]?.[metric] ?? [] }));
  const refRaw = metric === "xp" ? undefined : data.reference?.[metric];
  const ref = refRaw && showRef ? [0, ...refRaw] : undefined;
  const minutes = tl.minutes;
  const max = Math.max(1, ...series.flatMap((s) => s.data), ...(ref?.slice(0, minutes + 1) ?? []));
  const x = (m: number) => PAD.l + (m / Math.max(1, minutes)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const path = (d: number[]) => d.slice(0, minutes + 1).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const at = Math.min(10, minutes);
  const myAt = mine ? tl.frames[mine.participantId]?.[metric][at] : undefined;
  const oppAt = opp ? tl.frames[opp.participantId]?.[metric][at] : undefined;
  const refAt = refRaw?.[at - 1];
  const fmt = (v: number) => (metric === "cs" ? String(v) : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));
  const labelOf = { gold: A.gold, xp: D.xp, cs: A.cs };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 rounded-lg border border-line bg-panel p-0.5">
          {(["gold", "xp", "cs"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={metric === m}
              onClick={() => setMetric(m)}
              className={`rounded-md px-2.5 py-1 text-xs ${metric === m ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"}`}
            >
              {labelOf[m]}
            </button>
          ))}
        </div>
        {refRaw && (
          <button
            type="button"
            aria-pressed={showRef}
            onClick={() => setShowRef(!showRef)}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1 text-xs ${showRef ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"}`}
          >
            <svg width="16" height="6" aria-hidden>
              <line x1="0" y1="3" x2="16" y2="3" stroke="var(--color-fg)" strokeWidth="2" strokeDasharray="4 3" opacity="0.6" />
            </svg>
            {fill(A.reference, { bracket: data.reference!.bracket })}
          </button>
        )}
      </div>

      <PlayerPicker
        players={players}
        selected={selected}
        colors={PLAYER_COLORS}
        multiple
        onSelect={(pid) => setSelected((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]))}
      />

      <div className="rounded-xl border border-line bg-panel-2/40 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={labelOf[metric]}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-line)" />
              <text x={PAD.l - 6} y={y(max * f) + 3} textAnchor="end" fontSize="9" fill="var(--color-faint)">
                {fmt(Math.round(max * f))}
              </text>
            </g>
          ))}
          {[0, 5, 10, 15, 20, 25, 30, 35, 40].filter((m) => m <= minutes).map((m) => (
            <text key={m} x={x(m)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
              {m}′
            </text>
          ))}
          <line x1={x(at)} x2={x(at)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-line-strong)" strokeDasharray="2 3" />
          {ref && <path d={path(ref)} fill="none" stroke="var(--color-fg)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.5" />}
          {series.map((s) => (
            <path
              key={s.pid}
              d={path(s.data)}
              fill="none"
              stroke={PLAYER_COLORS[s.pid]}
              strokeWidth={players.find((p) => p.participantId === s.pid)?.puuid === me ? 2.5 : 1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>

        {myAt !== undefined && metric !== "xp" && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="text-fg">
              {fill(A.atMinute, { m: at })}: <span className="tabular font-medium">{myAt.toLocaleString()}</span> {labelOf[metric]}
            </span>
            {refAt !== undefined && (
              <span style={{ color: myAt - refAt >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>{fill(A.vsRef, { diff: signed(myAt - refAt) })}</span>
            )}
            {oppAt !== undefined && (
              <span style={{ color: myAt - oppAt >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>{fill(A.vsOpp, { diff: signed(myAt - oppAt) })}</span>
            )}
          </p>
        )}
        {!data.reference && metric !== "xp" && <p className="mt-2 text-[11px] text-faint">{A.noRef}</p>}
      </div>
    </div>
  );
}
