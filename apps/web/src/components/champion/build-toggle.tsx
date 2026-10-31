"use client";

import { type ReactNode, useState } from "react";

/** Cambia entre la build de mayor winrate y la más jugada (ambas renderizadas en el servidor). */
export function BuildToggle({ best, common, labels }: { best: ReactNode; common: ReactNode; labels: { best: string; common: string; help: string } }) {
  const [mode, setMode] = useState<"best" | "common">("best");
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-1 rounded-lg border border-line bg-panel-2/50 p-0.5">
          {(["best", "common"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === m ? "bg-panel-3 text-fg" : "text-faint hover:text-muted"}`}
            >
              {labels[m]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-faint">{labels.help}</p>
      </div>
      {mode === "best" ? best : common}
    </div>
  );
}
