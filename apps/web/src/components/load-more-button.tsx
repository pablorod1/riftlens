"use client";

import { useActionState } from "react";
import { loadMoreMatches, type UpdateState } from "@/app/actions";

export function LoadMoreButton({ region, puuid, lang, labels }: { region: string; puuid: string; lang: string; labels: { idle: string; pending: string } }) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(loadMoreMatches, { status: "idle" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="puuid" value={puuid} />
      <input type="hidden" name="lang" value={lang} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-line-strong px-3.5 py-2 text-sm font-medium transition-colors hover:border-accent/50 hover:text-accent-strong disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? labels.pending : labels.idle}
      </button>
      {state.message && !pending && (
        <span role="status" className={`text-xs ${state.status === "error" ? "text-loss" : "text-muted"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
