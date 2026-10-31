import { confidence, SMALL_SAMPLE, wilson } from "@riftlens/core";
import { t } from "@/i18n/config";
import type { Dictionary } from "@/i18n/server";
import { pct } from "@/lib/format";

/**
 * Winrate con su intervalo de confianza al 95 %. La barra muestra el rango
 * plausible del winrate real; cuanto más ancha, menos fiable es la cifra.
 */
export function Winrate({ wins, games, dict }: { wins: number; games: number; dict: Dictionary }) {
  const wr = games ? wins / games : 0;
  const { low, high } = wilson(wins, games);
  const conf = confidence(games);
  const color = wr >= 0.5 ? "var(--color-win)" : "var(--color-loss)";
  return (
    <div
      className="w-20"
      title={t(dict.profile.ciTooltip, { low: pct(low), high: pct(high), n: games, confidence: dict.profile.confidence[conf] })}
    >
      <div className="tabular flex items-baseline justify-between text-sm">
        <span className="tabular font-medium" style={{ color }}>
          {pct(wr)}
        </span>
        {games < SMALL_SAMPLE && <span className="text-[10px] uppercase text-faint">±{Math.round(((high - low) / 2) * 100)}</span>}
      </div>
      <div className="relative mt-1.5 h-1 rounded-full bg-panel-3">
        <div className="absolute inset-y-0 left-1/2 w-px bg-faint" />
        <div
          className="absolute inset-y-0 rounded-full opacity-35"
          style={{ left: `${low * 100}%`, width: `${(high - low) * 100}%`, background: color }}
        />
        <div className="absolute -top-[3px] h-2.5 w-0.5 rounded" style={{ left: `calc(${wr * 100}% - 1px)`, background: color }} />
      </div>
    </div>
  );
}
