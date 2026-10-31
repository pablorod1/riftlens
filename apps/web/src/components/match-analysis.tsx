"use client";

import { useState, useTransition } from "react";
import { analyzeMatch, type MatchAnalysis } from "@/app/actions";
import type { Dictionary } from "@/i18n/dictionaries/es";

type Metric = "cs" | "gold";
const W = 640;
const H = 200;
const PAD = { l: 36, r: 12, t: 12, b: 22 };

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

const signed = (n: number, metric: Metric) =>
  `${n >= 0 ? "+" : "−"}${metric === "gold" ? Math.abs(Math.round(n)).toLocaleString() : Math.abs(Math.round(n))}`;

/**
 * Curvas de CS u oro minuto a minuto: tú, tu rival de línea y la mediana de alto
 * elo de tu campeón. Se pide bajo demanda (1 petición a Riot).
 */
export function MatchAnalysisView({ matchId, puuid, region, lang, labels }: { matchId: string; puuid: string; region: string; lang: string; labels: Dictionary["analysis"] }) {
  const [result, setResult] = useState<MatchAnalysis | null>(null);
  const [metric, setMetric] = useState<Metric>("cs");
  const [pending, start] = useTransition();

  if (!result?.ok) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setResult(await analyzeMatch({ matchId, puuid, region, lang })))}
          className="flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent/50 hover:text-accent-strong disabled:cursor-wait disabled:opacity-60"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
            <path d="M2 13l4-5 3 3 5-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {pending ? labels.loading : labels.cta}
        </button>
        {result?.message && <span className="text-xs text-loss">{result.message}</span>}
      </div>
    );
  }

  const series = [
    { key: "you", label: labels.you, data: result.you?.[metric], stroke: "var(--color-accent)", dash: "" },
    { key: "opp", label: result.opponentName ? `${labels.opponent} · ${result.opponentName}` : labels.opponent, data: result.opponent?.[metric], stroke: "var(--color-loss)", dash: "" },
    { key: "ref", label: fill(labels.reference, { bracket: result.bracket ?? "" }), data: result.reference?.[metric], stroke: "var(--color-fg)", dash: "4 4" },
  ].filter((s): s is typeof s & { data: number[] } => !!s.data?.length);

  const minutes = Math.max(2, Math.min(25, ...series.filter((s) => s.key !== "ref").map((s) => s.data.length)));
  const max = Math.max(1, ...series.flatMap((s) => s.data.slice(0, minutes)));
  const x = (i: number) => PAD.l + (i / (minutes - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const path = (d: number[]) => d.slice(0, minutes).map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const at = Math.min(10, minutes);
  const value = (key: string) => series.find((s) => s.key === key)?.data[at - 1];
  const you = value("you");
  const opp = value("opp");
  const ref = value("ref");

  return (
    <div className="animate-fade-up rounded-xl border border-line bg-panel-2/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 rounded-lg border border-line bg-panel p-0.5">
          {(["cs", "gold"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={metric === m}
              onClick={() => setMetric(m)}
              className={`rounded-md px-2.5 py-1 text-xs ${metric === m ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"}`}
            >
              {labels[m]}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-4 text-[11px] text-muted">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <svg width="16" height="6" aria-hidden>
                <line x1="0" y1="3" x2="16" y2="3" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.dash} opacity={s.key === "ref" ? 0.6 : 1} />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={labels[metric]}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-line)" />
            <text x={PAD.l - 6} y={y(max * f) + 3} textAnchor="end" fontSize="9" fill="var(--color-faint)">
              {metric === "gold" ? `${Math.round((max * f) / 1000)}k` : Math.round(max * f)}
            </text>
          </g>
        ))}
        {[5, 10, 15, 20, 25].filter((m) => m <= minutes).map((m) => (
          <text key={m} x={x(m - 1)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
            {m}′
          </text>
        ))}
        <line x1={x(at - 1)} x2={x(at - 1)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-line-strong)" strokeDasharray="2 3" />
        {series.map((s) => (
          <path
            key={s.key}
            d={path(s.data)}
            fill="none"
            stroke={s.stroke}
            strokeWidth={s.key === "you" ? 2.25 : 1.5}
            strokeDasharray={s.dash}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={s.key === "ref" ? 0.55 : s.key === "opp" ? 0.8 : 1}
          />
        ))}
      </svg>

      {you !== undefined && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="text-fg">
            {fill(labels.atMinute, { m: at })}: <span className="tabular font-medium">{metric === "gold" ? Math.round(you).toLocaleString() : you}</span> {labels[metric]}
          </span>
          {ref !== undefined && (
            <span style={{ color: you - ref >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>{fill(labels.vsRef, { diff: signed(you - ref, metric) })}</span>
          )}
          {opp !== undefined && (
            <span style={{ color: you - opp >= 0 ? "var(--color-win)" : "var(--color-loss)" }}>{fill(labels.vsOpp, { diff: signed(you - opp, metric) })}</span>
          )}
        </p>
      )}
      {!result.reference && <p className="mt-2 text-[11px] text-faint">{labels.noRef}</p>}
    </div>
  );
}
