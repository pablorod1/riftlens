import type { ObjectiveKind } from "@riftlens/riot";

/** Glifos mínimos y propios para cada objetivo (se colorean con currentColor). */
export function ObjectiveIcon({ kind, className = "size-3.5" }: { kind: ObjectiveKind | "champion"; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className}>
      {kind === "tower" && <path d="M5 14V7L4 3h2l.5 1.5h3L10 3h2l-1 4v7z" {...common} />}
      {kind === "inhibitor" && <circle cx="8" cy="8" r="5" {...common} />}
      {(kind === "dragon" || kind === "elder") && <path d="M8 2l5 6-5 6-5-6z" {...common} fill={kind === "elder" ? "currentColor" : "none"} />}
      {kind === "baron" && <path d="M8 2l5 3v6l-5 3-5-3V5z" {...common} />}
      {kind === "herald" && <path d="M3 9a5 5 0 0110 0v4H3zM6 9h.01M10 9h.01" {...common} />}
      {kind === "horde" && <path d="M4 10a2 2 0 104 0 2 2 0 10-4 0M8 6a2 2 0 104 0 2 2 0 10-4 0" {...common} />}
      {kind === "atakhan" && <path d="M3 13l2-9 3 4 3-4 2 9z" {...common} />}
      {kind === "champion" && <path d="M4 12l8-8M9 4h3v3M4 4l3 3M12 12l-2.5-2.5" {...common} />}
    </svg>
  );
}
