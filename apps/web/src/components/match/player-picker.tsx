"use client";

import type { PlayerMeta } from "./types";

/** Selector de jugador: los 10 campeones, azul a la izquierda y rojo a la derecha. */
export function PlayerPicker({
  players,
  selected,
  onSelect,
  colors,
  multiple = false,
}: {
  players: PlayerMeta[];
  selected: number[];
  onSelect: (participantId: number) => void;
  colors?: Record<number, string>;
  multiple?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {[100, 200].map((team) => (
        <div key={team} className="flex gap-1.5">
          {players
            .filter((p) => p.teamId === team)
            .map((p) => {
              const on = selected.includes(p.participantId);
              const color = colors?.[p.participantId] ?? (team === 100 ? "var(--color-win)" : "var(--color-loss)");
              return (
                <button
                  key={p.participantId}
                  type="button"
                  aria-pressed={on}
                  title={`${p.championName} · ${p.name}`}
                  onClick={() => onSelect(p.participantId)}
                  className={`rounded-lg p-0.5 transition-opacity ${on ? "opacity-100" : multiple ? "opacity-35 hover:opacity-70" : "opacity-50 hover:opacity-80"}`}
                  style={{ boxShadow: on ? `0 0 0 2px ${color}` : undefined }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.icon} alt={p.championName} width={30} height={30} className="rounded-md" />
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}
