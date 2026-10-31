# Riftlens

Estadísticas de League of Legends **calculadas para ti**: perfiles, rankings, builds, matchups y tier lists en un solo sitio, con estadística honesta (cada winrate con su intervalo de confianza).

## Estructura

```
apps/
  web/       Next.js 16 (App Router, Cache Components) — la web
  worker/    Procesos en segundo plano (ranking; en fase 2, crawler de partidas + DuckDB)
packages/
  riot/      Cliente tipado de la API de Riot con limitador por región + Data Dragon
  db/        Esquema Drizzle y cliente libSQL (SQLite en local, Turso en producción)
  core/      Lógica compartida: actualizar perfiles, ranking, estadística
```

## Puesta en marcha

```bash
bun install
cp .env.example .env        # pon tu RIOT_API_KEY (developer.riotgames.com)
bun run db:push             # crea data/riftlens.db
bun run dev                 # http://localhost:3000 (redirige a /en o /es)
```

¿Sin clave de Riot? Carga datos ficticios para ver la web:

```bash
bun run seed:demo           # perfil, ranking y tier list ficticios (/es/champions)
```

Ranking de Maestro+ (el worker lo rellena):

```bash
bun run worker:ladder                       # EUW, una vez
bun run worker:ladder -- --region kr
bun run worker:ladder -- --watch            # cada 30 min
```

Builds, matchups y tier list (crawler + agregador):

```bash
bun run worker:crawl -- --seed      # siembra Esmeralda+ y rastrea partidas del parche actual (Ctrl+C para parar)
```

Para dejarlo rastreando siempre (se relanza solo, cambia de parche, resiembra jugadores cada 24 h y aguanta errores puntuales de Riot):

```bash
deploy/launchd/install.sh             # macOS: servicio de usuario, log en data/logs/crawler.log
deploy/launchd/install.sh uninstall
```

En la VM de producción, `deploy/systemd/riftlens-crawler.service` hace lo mismo con systemd. Necesita una clave de Riot que no caduque (personal o de producción): la de desarrollo dura 24 h y, al caducar, el crawler se queda reintentando hasta que la cambies en `.env`.

El crawler descarga cada partida con su línea temporal (orden de compra, habilidades y curvas para el coach; `--no-timelines` va el doble de rápido sin ellas) y **publica los agregados cada 30 minutos y al parar** (`--publish-every`). Las partidas en bruto se guardan en `data/matches.duckdb`: DuckDB solo admite un proceso a la vez, así que `bun run worker:aggregate` es para cuando el crawler está parado.

Con la clave de desarrollo (100 peticiones / 2 min) resolver todos los Riot ID de Maestro+ tarda un rato: el ranking aparece al momento y los nombres se van rellenando.

La cuota de la clave es compartida: `RIOT_WEB_SHARE` y `RIOT_WORKER_SHARE` (0.5 por defecto) reparten las peticiones para que el worker nunca deje a la web sin cuota. Si aun así Riot está saturado, la web muestra un aviso en lugar de quedarse cargando (espera máxima de 10 s).

## Idiomas

Rutas con prefijo (`/en/...`, `/es/...`). `apps/web/src/proxy.ts` redirige las URLs sin idioma según la cookie `NEXT_LOCALE` o `Accept-Language` (por defecto, inglés).

Para añadir un idioma:
1. Copia `apps/web/src/i18n/dictionaries/en.ts` (TypeScript avisa si falta alguna clave respecto a `es.ts`).
2. Añádelo en `apps/web/src/i18n/config.ts` (`locales`, `localeNames`, `intlLocale`, `ddragonLocale`) y en `server.ts`.

Los nombres de campeones, objetos y runas vienen traducidos de Data Dragon.

## Arquitectura

| Pieza | Dónde | Notas |
|---|---|---|
| Web | Cloudflare (Workers/Pages) | Lee solo de Turso |
| Perfiles, rankings y agregados | Turso | Pocas escrituras, lecturas baratas |
| Crawler + partidas en bruto | VM Oracle Cloud Always Free + DuckDB | Fase 2: calcula builds/matchups y sube los agregados a Turso |

## Hoja de ruta

1. ✅ Buscador por Riot ID, perfil (rango, historial, campeones) y rankings Maestro+, en inglés y español
2. ✅ Crawler (DuckDB) y agregados: builds, runas, matchups y tier list por elo (Esmeralda+, Diamante+, Maestro+) · pendiente: pedir production key, orden de compra y de habilidades (timelines)
3. ✅ Pestaña Coach: comparación con las medianas de alto elo y consejos, matchups personalizados (bayesiano global + tu historial), optimizador de pool y análisis minuto a minuto de cada partida; orden de compra y de habilidades en las builds
4. Partida en directo, más regiones y elos; resumen de partida con IA

## Licencia

[MIT](LICENSE). Las contribuciones son bienvenidas: empieza por [CONTRIBUTING.md](CONTRIBUTING.md).

Riftlens no está respaldado por Riot Games. Los datos del juego se obtienen de la API oficial de Riot y de Data Dragon, y están sujetos a sus propias condiciones.
