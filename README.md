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
bun run seed:demo           # /es/summoner/euw/Demo-EUW y /es/rankings/euw
```

Ranking de Maestro+ (el worker lo rellena):

```bash
bun run worker:ladder                       # EUW, una vez
bun run worker:ladder -- --region kr
bun run worker:ladder -- --watch            # cada 30 min
```

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
2. Crawler y agregados: builds, runas, matchups y tier list (Esmeralda+, EUW) → pedir production key
3. Diferenciadores: matchups personalizados (bayesiano global + tu historial), coach comparativo minuto a minuto, optimizador de pool
4. Partida en directo, más regiones y elos; resumen de partida con IA

## Licencia

[MIT](LICENSE). Las contribuciones son bienvenidas.

Riftlens no está respaldado por Riot Games. Los datos del juego se obtienen de la API oficial de Riot y de Data Dragon, y están sujetos a sus propias condiciones.
