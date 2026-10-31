import { confidence, SMALL_SAMPLE, wilson } from "@riftlens/core";
import { pct } from "@/lib/format";

/**
 * Winrate con su intervalo de confianza al 95 %. La barra muestra el rango
 * plausible del winrate real; cuanto más ancha, menos fiable es la cifra.
 */
export function Winrate({ wins, games }: { wins: number; games: number }) {
  const wr = games ? wins / games : 0;
  const { low, high } = wilson(wins, games);
  const conf = confidence(games);
  const color = wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)";
  return (
    <div
      className="w-24"
      title={`Winrate real probable entre ${pct(low)} y ${pct(high)} (95 %, ${games} partidas). Confianza ${conf}.`}
    >
      <div className="tabular flex items-baseline justify-between text-sm">
        <span className="font-semibold" style={{ color }}>
          {pct(wr)}
        </span>
        {games < SMALL_SAMPLE && <span className="text-[10px] uppercase text-faint">±{Math.round(((high - low) / 2) * 100)}</span>}
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-panel-2">
        <div className="absolute inset-y-0 left-1/2 w-px bg-faint" />
        <div
          className="absolute inset-y-0 rounded-full opacity-35"
          style={{ left: `${low * 100}%`, width: `${(high - low) * 100}%`, background: color }}
        />
        <div className="absolute -top-0.5 h-2.5 w-0.5 rounded" style={{ left: `calc(${wr * 100}% - 1px)`, background: color }} />
      </div>
    </div>
  );
}
