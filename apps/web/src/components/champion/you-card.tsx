"use client";

import { useEffect, useState } from "react";
import type { PlayerChampionDto } from "@/app/api/player-champion/route";
import { useRecent } from "../use-recent";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const fmt: Record<string, (v: number) => string> = {
  csPerMin: (v) => v.toFixed(1),
  goldPerMin: (v) => Math.round(v).toString(),
  damagePerMin: (v) => Math.round(v).toString(),
  visionPerMin: (v) => v.toFixed(2),
  killParticipation: (v) => pct(v),
  deaths: (v) => v.toFixed(1),
};

/**
 * Tarjeta personal en la ficha de campeón: usa los perfiles visitados en este
 * navegador (no hay cuentas) y compara sus partidas con la media del campeón.
 */
export function YouCard({
  championId,
  position,
  championName,
  labels,
  metricLabels,
}: {
  championId: number;
  position: string;
  championName: string;
  labels: { title: string; help: string; noGames: string; games: string; better: string; worse: string };
  metricLabels: Record<string, string>;
}) {
  const recent = useRecent();
  // Perfil elegido a mano; si no, el primero de los recientes que tengamos guardado
  const [chosen, setChosen] = useState<number | null>(null);
  const [auto, setAuto] = useState<{ index: number; data: PlayerChampionDto } | null>(null);
  const [manual, setManual] = useState<PlayerChampionDto | null>(null);

  const fetchFor = (i: number, signal: AbortSignal) => {
    const p = recent[i]!;
    const q = new URLSearchParams({ region: p.region, name: p.gameName, tag: p.tagLine, champion: String(championId), position });
    return fetch(`/api/player-champion?${q}`, { signal }).then((r) => r.json() as Promise<PlayerChampionDto>);
  };

  useEffect(() => {
    if (!recent.length || chosen !== null) return;
    const ctrl = new AbortController();
    (async () => {
      for (let i = 0; i < Math.min(recent.length, 4); i++) {
        try {
          const d = await fetchFor(i, ctrl.signal);
          if (d.found) return setAuto({ index: i, data: d });
        } catch {
          return;
        }
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent, championId, position, chosen]);

  useEffect(() => {
    if (chosen === null) return;
    const ctrl = new AbortController();
    fetchFor(chosen, ctrl.signal)
      .then(setManual)
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, championId, position]);

  const who = chosen ?? auto?.index ?? 0;
  const data = chosen !== null ? manual : auto?.data ?? null;
  const player = recent[who];
  const setWho = (i: number) => {
    setManual(null);
    setChosen(i);
  };

  if (!player || !data?.found) return null;

  return (
    <section className="rounded-2xl border border-accent/25 bg-accent/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{labels.title.replace("{champion}", championName)}</h2>
        {recent.length > 1 ? (
          <select
            value={who}
            onChange={(e) => setWho(Number(e.target.value))}
            className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted outline-none"
          >
            {recent.map((r, i) => (
              <option key={`${r.region}-${r.gameName}-${r.tagLine}`} value={i}>
                {r.gameName}#{r.tagLine}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted">
            {player.gameName}#{player.tagLine}
          </span>
        )}
      </div>
      {!data.games ? (
        <p className="mt-3 text-sm text-muted">{labels.noGames.replace("{champion}", championName)}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-faint">
            {labels.games.replace("{n}", String(data.games))} · {pct(data.wins / data.games)} WR · {labels.help}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {data.comparisons.map((c) => {
              const good = c.delta >= 0;
              const color = Math.abs(c.delta) < 0.05 ? "var(--color-muted)" : good ? "var(--color-win)" : "var(--color-loss)";
              return (
                <li key={c.key} className="rounded-xl border border-line bg-panel/60 p-3">
                  <p className="text-[10px] text-faint">{metricLabels[c.key] ?? c.key}</p>
                  <p className="tabular mt-1 text-base font-semibold">{fmt[c.key]?.(c.mine) ?? c.mine}</p>
                  <p className="tabular text-[10px]" style={{ color }}>
                    {(good ? labels.better : labels.worse).replace("{pct}", pct(Math.abs(c.delta)))} · {fmt[c.key]?.(c.ref) ?? c.ref}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
