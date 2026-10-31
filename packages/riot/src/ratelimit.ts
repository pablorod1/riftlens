/**
 * Limitador de ventana deslizante por host de Riot.
 *
 * Riot aplica los límites de aplicación por "routing value" (euw1, europe…),
 * así que mantenemos un limitador por host. Los 429 se gestionan en el cliente
 * respetando Retry-After; aquí solo evitamos provocarlos.
 */
export interface RateWindow {
  requests: number;
  seconds: number;
}

/** "20:1,100:120" -> [{20 peticiones / 1 s}, {100 peticiones / 120 s}] */
export function parseRateLimits(spec: string): RateWindow[] {
  return spec
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [requests, seconds] = part.split(":").map(Number);
      if (!requests || !seconds) throw new Error(`Límite inválido: "${part}"`);
      return { requests, seconds };
    });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Se lanza cuando conseguir hueco llevaría más tiempo del permitido. */
export class RateLimitWaitError extends Error {
  constructor(public readonly waitMs: number) {
    super(`Haría falta esperar ${Math.ceil(waitMs / 1000)} s por el límite de peticiones`);
    this.name = "RateLimitWaitError";
  }
}

/**
 * Reparte la cuota entre procesos que comparten clave: con share = 0.5 este
 * proceso solo usa la mitad de cada ventana (mínimo 1 petición).
 */
export function scaleWindows(windows: RateWindow[], share: number): RateWindow[] {
  return windows.map((w) => ({ requests: Math.max(1, Math.floor(w.requests * share)), seconds: w.seconds }));
}

export class RateLimiter {
  private windows: RateWindow[];
  /** Marcas de tiempo (ms) de las peticiones recientes, ordenadas. */
  private log: number[] = [];
  /** Bloqueo global hasta este instante (tras un 429). */
  private blockedUntil = 0;
  /** Cola de espera para atender en orden FIFO. */
  private queue: Promise<void> = Promise.resolve();

  constructor(windows: RateWindow[]) {
    // Pequeño margen de seguridad: la ventana de Riot no está alineada con la nuestra.
    this.windows = windows.map((w) => ({ requests: w.requests, seconds: w.seconds + 0.25 }));
  }

  setWindows(windows: RateWindow[]) {
    this.windows = windows.map((w) => ({ requests: w.requests, seconds: w.seconds + 0.25 }));
  }

  blockFor(ms: number) {
    this.blockedUntil = Math.max(this.blockedUntil, Date.now() + ms);
  }

  /**
   * Espera hasta que haya hueco en todas las ventanas y reserva la petición.
   * Con maxWaitMs, en vez de esperar más de la cuenta lanza RateLimitWaitError.
   */
  acquire(maxWaitMs = Infinity): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    const next = this.queue.then(() => this.waitForSlot(deadline));
    this.queue = next.catch(() => {});
    return next;
  }

  private async waitForSlot(deadline: number) {
    for (;;) {
      const now = Date.now();
      if (now < this.blockedUntil) {
        if (this.blockedUntil > deadline) throw new RateLimitWaitError(this.blockedUntil - now);
        await sleep(this.blockedUntil - now);
        continue;
      }
      const longest = Math.max(...this.windows.map((w) => w.seconds)) * 1000;
      while (this.log.length && this.log[0]! <= now - longest) this.log.shift();

      let waitMs = 0;
      for (const w of this.windows) {
        const since = now - w.seconds * 1000;
        // Número de peticiones dentro de esta ventana (el log está ordenado).
        let firstInside = this.log.findIndex((t) => t > since);
        if (firstInside === -1) firstInside = this.log.length;
        const count = this.log.length - firstInside;
        if (count >= w.requests) {
          const oldestRelevant = this.log[this.log.length - w.requests]!;
          waitMs = Math.max(waitMs, oldestRelevant + w.seconds * 1000 - now);
        }
      }
      if (waitMs <= 0) {
        this.log.push(now);
        return;
      }
      if (now + waitMs > deadline) throw new RateLimitWaitError(waitMs);
      await sleep(waitMs);
    }
  }
}
