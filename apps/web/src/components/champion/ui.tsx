import type { BuildEntry } from "@riftlens/db";

export const wrColor = (wr: number) => (wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)");
export const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

export function Card({ title, help, children, className = "", aside }: { title: string; help?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow" title={help}>
          {title}
          {help && <span className="ml-1 cursor-help text-faint/70">ⓘ</span>}
        </h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Winrate y partidas (y % sobre el total si se indica) de una opción. */
export function Stat({ e, total, align = "right" }: { e: BuildEntry; total?: number; align?: "right" | "center" }) {
  const wr = e.games ? e.wins / e.games : 0;
  return (
    <div className={`tabular shrink-0 text-xs ${align === "center" ? "text-center" : "text-right"}`}>
      <p className="font-medium" style={{ color: wrColor(wr) }}>
        {pct1(wr)}
      </p>
      <p className="text-[10px] text-faint">
        {total ? `${pct1(e.games / total)} · ` : ""}
        {e.games.toLocaleString()}
      </p>
    </div>
  );
}
