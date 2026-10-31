"use client";

import { useActionState } from "react";
import { updateProfile, type UpdateState } from "@/app/actions";

export function RefreshButton({
  region,
  puuid,
  lang,
  labels,
}: {
  region: string;
  puuid: string;
  lang: string;
  labels: { refresh: string; refreshing: string };
}) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(updateProfile, { status: "idle" });
  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-3">
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="puuid" value={puuid} />
      <input type="hidden" name="lang" value={lang} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-lg border border-line-strong bg-panel px-3.5 py-2 text-sm font-medium transition-colors hover:border-accent/50 hover:text-accent-strong disabled:cursor-wait disabled:opacity-60"
      >
        <svg viewBox="0 0 16 16" aria-hidden className={`size-3.5 ${pending ? "animate-spin" : ""}`}>
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {pending ? labels.refreshing : labels.refresh}
      </button>
      {state.message && !pending && (
        <span role="status" className={`text-xs ${state.status === "error" ? "text-loss" : "text-muted"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
