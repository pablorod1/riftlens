import { parseRateLimits, RateLimiter, RateLimitWaitError, scaleWindows, type RateWindow } from "./ratelimit";
import type {
  AccountDto,
  LeagueEntryDto,
  LeagueListDto,
  MatchDto,
  MatchIdsQuery,
  SummonerDto,
} from "./types";

export class RiotApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message?: string,
  ) {
    super(message ?? `Riot API ${status} en ${path}`);
    this.name = "RiotApiError";
  }
  get isNotFound() {
    return this.status === 404;
  }
  /** 401/403: clave ausente, caducada o sin permiso para ese endpoint. */
  get isAuth() {
    return this.status === 401 || this.status === 403;
  }
  /** 429 o espera local demasiado larga: Riot está saturado para esta clave. */
  get isRateLimited() {
    return this.status === 429;
  }
}

/** ¿El error indica que nos hemos quedado sin cuota (y conviene reintentar más tarde)? */
export function isRateLimitError(err: unknown): err is RiotApiError {
  return err instanceof RiotApiError && err.isRateLimited;
}

export interface RiotClientOptions {
  apiKey: string;
  /** Límites de aplicación, p. ej. "20:1,100:120". Se ajustan solos con las cabeceras de Riot. */
  rateLimits?: string | RateWindow[];
  maxRetries?: number;
  /**
   * Fracción de la cuota de la clave que usa este proceso (0–1]. La clave es
   * compartida: si el worker usa 0.5, la web siempre tiene la otra mitad.
   */
  share?: number;
  /**
   * Espera máxima por el limitador o por un Retry-After. Para peticiones de
   * usuarios conviene acotarla y mostrar un aviso en vez de cargar sin fin.
   */
  maxWaitMs?: number;
  fetch?: FetchLike;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Firma mínima de fetch (permite inyectar uno simulado en tests y en el seed de demo). */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class RiotClient {
  private readonly apiKey: string;
  private readonly windows: RateWindow[];
  private readonly limiters = new Map<string, RateLimiter>();
  private readonly maxRetries: number;
  private readonly share: number;
  private readonly maxWaitMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(opts: RiotClientOptions) {
    if (!opts.apiKey) throw new Error("Falta RIOT_API_KEY");
    this.apiKey = opts.apiKey;
    this.windows =
      typeof opts.rateLimits === "string"
        ? parseRateLimits(opts.rateLimits)
        : (opts.rateLimits ?? parseRateLimits("20:1,100:120"));
    this.maxRetries = opts.maxRetries ?? 3;
    this.share = Math.min(1, Math.max(0.01, opts.share ?? 1));
    this.maxWaitMs = opts.maxWaitMs ?? Infinity;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private limiter(host: string) {
    let l = this.limiters.get(host);
    if (!l) {
      l = new RateLimiter(scaleWindows(this.windows, this.share));
      this.limiters.set(host, l);
    }
    return l;
  }

  private async request<T>(host: string, path: string, query?: Record<string, unknown>): Promise<T> {
    const url = new URL(`https://${host}.api.riotgames.com${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const limiter = this.limiter(host);

    for (let attempt = 0; ; attempt++) {
      try {
        await limiter.acquire(this.maxWaitMs);
      } catch (err) {
        if (err instanceof RateLimitWaitError) throw new RiotApiError(429, path, err.message);
        throw err;
      }
      let res: Response;
      try {
        res = await this.fetchImpl(url, { headers: { "X-Riot-Token": this.apiKey } });
      } catch (err) {
        if (attempt >= this.maxRetries) throw err;
        await sleep(500 * 2 ** attempt);
        continue;
      }

      const appLimit = res.headers.get("x-app-rate-limit");
      if (appLimit) {
        try {
          limiter.setWindows(scaleWindows(parseRateLimits(appLimit), this.share));
        } catch {
          /* cabecera inesperada: mantenemos los límites configurados */
        }
      }

      if (res.ok) return (await res.json()) as T;

      if (res.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "1");
        limiter.blockFor(retryAfter * 1000);
        if (retryAfter * 1000 > this.maxWaitMs) {
          throw new RiotApiError(429, path, `Riot pide esperar ${retryAfter} s`);
        }
        continue;
      }
      if (res.status >= 500 && attempt < this.maxRetries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new RiotApiError(res.status, path);
    }
  }

  // ---- account-v1 (rutas regionales: americas | europe | asia)

  accountByRiotId(route: string, gameName: string, tagLine: string) {
    return this.request<AccountDto>(
      route,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
  }

  accountByPuuid(route: string, puuid: string) {
    return this.request<AccountDto>(route, `/riot/account/v1/accounts/by-puuid/${puuid}`);
  }

  // ---- summoner-v4 (plataforma)

  summonerByPuuid(platform: string, puuid: string) {
    return this.request<SummonerDto>(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  }

  // ---- league-v4 (plataforma)

  leagueEntriesByPuuid(platform: string, puuid: string) {
    return this.request<LeagueEntryDto[]>(platform, `/lol/league/v4/entries/by-puuid/${puuid}`);
  }

  apexLeague(platform: string, tier: "CHALLENGER" | "GRANDMASTER" | "MASTER", queue = "RANKED_SOLO_5x5") {
    const segment = { CHALLENGER: "challengerleagues", GRANDMASTER: "grandmasterleagues", MASTER: "masterleagues" }[tier];
    return this.request<LeagueListDto>(platform, `/lol/league/v4/${segment}/by-queue/${queue}`);
  }

  /** Entradas por división (DIAMOND I, EMERALD IV…). Paginado desde 1. */
  leagueEntries(platform: string, queue: string, tier: string, division: string, page = 1) {
    return this.request<LeagueEntryDto[]>(platform, `/lol/league/v4/entries/${queue}/${tier}/${division}`, { page });
  }

  // ---- match-v5 (rutas regionales: americas | europe | asia | sea)

  matchIdsByPuuid(route: string, puuid: string, query: MatchIdsQuery = {}) {
    return this.request<string[]>(route, `/lol/match/v5/matches/by-puuid/${puuid}/ids`, { ...query });
  }

  match(route: string, matchId: string) {
    return this.request<MatchDto>(route, `/lol/match/v5/matches/${matchId}`);
  }
}

let shared: RiotClient | undefined;

/**
 * Cliente compartido configurado con las variables de entorno.
 * Cada proceso (web, worker) pasa su `share` de la cuota en `overrides`.
 */
export function riotFromEnv(overrides: Partial<RiotClientOptions> = {}): RiotClient {
  shared ??= new RiotClient({
    apiKey: process.env.RIOT_API_KEY ?? "",
    rateLimits: process.env.RIOT_RATE_LIMITS || undefined,
    ...overrides,
  });
  return shared;
}
