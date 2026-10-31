"use client";

import { useActionState } from "react";
import { updateProfile, type UpdateState } from "@/app/actions";

export function RefreshButton({ region, puuid }: { region: string; puuid: string }) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(updateProfile, { status: "idle" });
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="puuid" value={puuid} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Actualizando…" : "Actualizar"}
      </button>
      {state.message && !pending && (
        <span role="status" className={`text-xs ${state.status === "error" ? "text-loss" : "text-muted"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
