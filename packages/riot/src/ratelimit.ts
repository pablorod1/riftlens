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

  /** Espera hasta que haya hueco en todas las ventanas y reserva la petición. */
  acquire(): Promise<void> {
    const next = this.queue.then(() => this.waitForSlot());
    this.queue = next.catch(() => {});
    return next;
  }

  private async waitForSlot() {
    for (;;) {
      const now = Date.now();
      if (now < this.blockedUntil) {
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
      await sleep(waitMs);
    }
  }
}
