import type { Tier } from "@riftlens/core";

const STYLE: Record<Tier, string> = {
  "S+": "text-bg bg-accent-strong",
  S: "text-accent-strong border border-accent/40",
  A: "text-fg border border-line-strong",
  B: "text-muted border border-line",
  C: "text-faint border border-line",
  D: "text-loss/80 border border-loss/20",
};

export function TierBadge({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-semibold tabular ${STYLE[tier]} ${
        size === "lg" ? "h-9 min-w-11 px-2 text-base" : "h-6 min-w-8 px-1.5 text-xs"
      }`}
    >
      {tier}
    </span>
  );
}
