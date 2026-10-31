import { REGIONS } from "@riftlens/riot";
import { searchSummoner } from "@/app/actions";

export function SearchForm({ size = "lg", defaultRegion = "euw" }: { size?: "lg" | "sm"; defaultRegion?: string }) {
  const lg = size === "lg";
  return (
    <form
      action={searchSummoner}
      role="search"
      className={`flex w-full items-stretch overflow-hidden rounded-xl border border-line bg-panel focus-within:border-accent ${
        lg ? "h-14" : "h-10"
      }`}
    >
      <label className="sr-only" htmlFor={`region-${size}`}>
        Región
      </label>
      <select
        id={`region-${size}`}
        name="region"
        defaultValue={defaultRegion}
        className={`cursor-pointer border-r border-line bg-panel-2 font-semibold uppercase text-muted outline-none ${
          lg ? "px-4 text-sm" : "px-2 text-xs"
        }`}
      >
        {REGIONS.map((r) => (
          <option key={r.slug} value={r.slug}>
            {r.slug.toUpperCase()}
          </option>
        ))}
      </select>
      <input
        name="q"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder="Nombre#TAG"
        aria-label="Riot ID"
        className={`min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-faint ${
          lg ? "px-4 text-lg" : "px-3 text-sm"
        }`}
      />
      <button
        type="submit"
        className={`bg-accent font-semibold text-bg transition-colors hover:bg-accent-strong ${lg ? "px-6" : "px-3 text-sm"}`}
      >
        Buscar
      </button>
    </form>
  );
}
