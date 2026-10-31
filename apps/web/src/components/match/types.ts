import type { Dictionary } from "@/i18n/dictionaries/es";

/** Lo mínimo de cada jugador que necesitan las vistas de cliente de una partida. */
export interface PlayerMeta {
  participantId: number;
  puuid: string;
  teamId: number;
  name: string;
  championName: string;
  icon: string;
  position: string;
  perks: number[];
  shards: number[];
  primaryStyle: number;
  subStyle: number;
}

export interface DetailLabels {
  d: Dictionary["matchDetails"];
  a: Dictionary["analysis"];
  victory: string;
  defeat: string;
  blue: string;
  red: string;
}

/** 10 colores distinguibles: fríos para el equipo azul, cálidos para el rojo. */
export const PLAYER_COLORS: Record<number, string> = {
  1: "#7ea6ff", 2: "#5fd4c4", 3: "#a78bfa", 4: "#60a5fa", 5: "#9be29b",
  6: "#ff7d8a", 7: "#f6a560", 8: "#f5d06b", 9: "#f08fd0", 10: "#c9a27e",
};

export const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
