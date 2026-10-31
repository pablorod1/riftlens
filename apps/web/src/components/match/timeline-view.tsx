"use client";

import { minimapImage, type MatchTimelineData } from "@riftlens/riot";
import { useMemo, useState } from "react";
import type { MatchTimelinePayload } from "@/app/actions";
import { ObjectiveIcon } from "../objective-icon";
import { mmss, type DetailLabels, type PlayerMeta } from "./types";

const W = 720;
const H = 150;
const PAD = { l: 40, r: 10, t: 10, b: 18 };
/** Tamaño aproximado de la Grieta en coordenadas de Riot. */
const MAP = 14870;

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const teamColor = (team: number) => (team === 100 ? "var(--color-win)" : "var(--color-loss)");

type Event =
  | ({ type: "kill" } & MatchTimelineData["kills"][number])
  | ({ type: "objective" } & MatchTimelineData["objectives"][number]);

export function TimelineView({ data, players, labels }: { data: MatchTimelinePayload; players: PlayerMeta[]; labels: DetailLabels }) {
  const tl = data.timeline!;
  const D = labels.d;
  const byId = useMemo(() => new Map(players.map((p) => [p.participantId, p])), [players]);
  const [minute, setMinute] = useState(tl.minutes);
  const [showKills, setShowKills] = useState(true);
  const [showObjectives, setShowObjectives] = useState(true);

  // Ventaja de oro del equipo azul por minuto
  const lead = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i <= tl.minutes; i++) {
      let sum = 0;
      for (const p of players) sum += (p.teamId === 100 ? 1 : -1) * (tl.frames[p.participantId]?.gold[i] ?? 0);
      out.push(sum);
    }
    return out;
  }, [tl, players]);
  const maxAbs = Math.max(1000, ...lead.map(Math.abs));
  const x = (m: number) => PAD.l + (m / Math.max(1, tl.minutes)) * (W - PAD.l - PAD.r);
  const mid = PAD.t + (H - PAD.t - PAD.b) / 2;
  const y = (v: number) => mid - (v / maxAbs) * ((H - PAD.t - PAD.b) / 2);
  const line = lead.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(tl.minutes)},${mid} L${x(0)},${mid} Z`;

  const events: Event[] = useMemo(
    () =>
      [
        ...(showKills ? tl.kills.map((k) => ({ type: "kill" as const, ...k })) : []),
        ...(showObjectives ? tl.objectives.map((o) => ({ type: "objective" as const, ...o })) : []),
      ].sort((a, b) => a.t - b.t),
    [tl, showKills, showObjectives],
  );
  const untilMs = (minute + 1) * 60_000;
  const visible = events.filter((e) => e.t <= untilMs);

  const champ = (id: number, size = 18) => {
    const p = byId.get(id);
    // eslint-disable-next-line @next/next/no-img-element
    return p ? <img src={p.icon} alt={p.championName} title={p.name} width={size} height={size} className="rounded" /> : null;
  };

  return (
    <div className="space-y-4">
      {/* Ventaja de oro + objetivos */}
      <div className="rounded-xl border border-line bg-panel-2/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">{D.goldLead}</p>
          <p className="tabular text-xs" style={{ color: (lead[minute] ?? 0) >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>
            {fill(D.minute, { m: minute })}: {(lead[minute] ?? 0) >= 0 ? "+" : "−"}
            {Math.abs(lead[minute] ?? 0).toLocaleString()}
          </p>
        </div>
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label={D.goldLead}>
          <defs>
            <clipPath id="above">
              <rect x="0" y="0" width={W} height={mid} />
            </clipPath>
            <clipPath id="below">
              <rect x="0" y={mid} width={W} height={H} />
            </clipPath>
          </defs>
          {[-1, -0.5, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(maxAbs * f)} y2={y(maxAbs * f)} stroke="var(--color-line)" />
              <text x={PAD.l - 6} y={y(maxAbs * f) + 3} textAnchor="end" fontSize="9" fill="var(--color-faint)">
                {`${f > 0 ? "+" : "−"}${Math.round((maxAbs * Math.abs(f)) / 1000)}k`}
              </text>
            </g>
          ))}
          <line x1={PAD.l} x2={W - PAD.r} y1={mid} y2={mid} stroke="var(--color-line-strong)" />
          <path d={area} fill="var(--color-win)" opacity="0.18" clipPath="url(#above)" />
          <path d={area} fill="var(--color-loss)" opacity="0.18" clipPath="url(#below)" />
          <path d={line} fill="none" stroke="var(--color-fg)" strokeWidth="1.5" opacity="0.8" strokeLinejoin="round" />
          <line x1={x(minute)} x2={x(minute)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-accent)" strokeDasharray="2 3" />
          {[0, 5, 10, 15, 20, 25, 30, 35, 40].filter((m) => m <= tl.minutes).map((m) => (
            <text key={m} x={x(m)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
              {m}′
            </text>
          ))}
          {tl.objectives.map((o, i) => (
            <g key={i} transform={`translate(${x(o.t / 60_000) - 6}, ${H + 4})`} color={teamColor(o.team)}>
              <foreignObject width="12" height="12">
                <ObjectiveIcon kind={o.kind} className="size-3" />
              </foreignObject>
            </g>
          ))}
        </svg>
        <input
          type="range"
          min={0}
          max={tl.minutes}
          value={minute}
          onChange={(e) => setMinute(Number(e.target.value))}
          aria-label={fill(D.minute, { m: minute })}
          className="mt-2 w-full accent-[var(--color-accent)]"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Minimapa */}
        <div className="relative aspect-square overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={minimapImage(data.version!)} alt="" className="absolute inset-0 size-full opacity-50 grayscale" />
          {visible.map((e, i) => {
            const ex = e.type === "kill" ? e.x : e.x;
            const ey = e.type === "kill" ? e.y : e.y;
            if (ex === undefined || ey === undefined) return null;
            const recent = untilMs - e.t < 120_000;
            const team = e.type === "kill" ? byId.get(e.killer)?.teamId ?? 100 : e.team;
            return (
              <span
                key={i}
                className="absolute flex -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full"
                style={{
                  left: `${(ex / MAP) * 100}%`,
                  bottom: `${(ey / MAP) * 100}%`,
                  width: e.type === "kill" ? (recent ? 12 : 8) : 16,
                  height: e.type === "kill" ? (recent ? 12 : 8) : 16,
                  background: e.type === "kill" ? teamColor(team) : "var(--color-bg)",
                  color: teamColor(team),
                  border: e.type === "objective" ? `1px solid ${teamColor(team)}` : undefined,
                  opacity: recent ? 1 : 0.45,
                  boxShadow: recent && e.type === "kill" ? `0 0 0 3px color-mix(in srgb, ${teamColor(team)} 30%, transparent)` : undefined,
                }}
              >
                {e.type === "objective" && <ObjectiveIcon kind={e.kind} className="size-2.5" />}
              </span>
            );
          })}
        </div>

        {/* Lista de eventos */}
        <div className="flex min-h-0 flex-col rounded-xl border border-line">
          <div className="flex gap-2 border-b border-line p-2">
            {[
              { on: showKills, set: setShowKills, label: D.showKills },
              { on: showObjectives, set: setShowObjectives, label: D.showObjectives },
            ].map((f) => (
              <button
                key={f.label}
                type="button"
                aria-pressed={f.on}
                onClick={() => f.set(!f.on)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${f.on ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ol className="max-h-[420px] flex-1 overflow-y-auto p-1.5 lg:max-h-none lg:h-0">
            {events.map((e, i) => {
              const past = e.t <= untilMs;
              const team = e.type === "kill" ? byId.get(e.killer)?.teamId ?? 100 : e.team;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setMinute(Math.min(tl.minutes, Math.floor(e.t / 60_000)))}
                    className={`flex w-full items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-left text-xs transition-opacity hover:bg-panel-2 ${past ? "" : "opacity-35"}`}
                    style={{ borderColor: teamColor(team) }}
                  >
                    <span className="tabular w-9 shrink-0 text-[10px] text-faint">{mmss(e.t)}</span>
                    {e.type === "kill" ? (
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {champ(e.killer)}
                        <span className="truncate">{byId.get(e.killer)?.name ?? "—"}</span>
                        <span className="text-faint">{D.killed}</span>
                        {champ(e.victim)}
                        <span className="truncate">{byId.get(e.victim)?.name}</span>
                        {e.firstBlood && <span className="rounded bg-loss/15 px-1 text-[9px] font-semibold text-loss">{D.firstBlood}</span>}
                        {e.assists.length > 0 && <span className="flex gap-0.5 opacity-70">{e.assists.map((a) => <span key={a}>{champ(a, 12)}</span>)}</span>}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5" style={{ color: teamColor(e.team) }}>
                        <ObjectiveIcon kind={e.kind} />
                        <span className="text-fg">
                          {e.team === 100 ? D.teamBlue : D.teamRed} {D.took} {D.objectiveOne[e.kind]}
                          {e.sub && e.kind === "dragon" && D.dragons[e.sub as keyof typeof D.dragons] ? ` (${D.dragons[e.sub as keyof typeof D.dragons]})` : ""}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
