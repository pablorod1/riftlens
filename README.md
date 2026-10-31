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
bun run dev                 # http://localhost:3000
```

Ranking de Maestro+ (el worker lo rellena):

```bash
bun run worker:ladder                       # EUW, una vez
bun run worker:ladder -- --region kr
bun run worker:ladder -- --watch            # cada 30 min
```

Con la clave de desarrollo (100 peticiones / 2 min) resolver todos los Riot ID de Maestro+ tarda un rato: el ranking aparece al momento y los nombres se van rellenando.

## Arquitectura

| Pieza | Dónde | Notas |
|---|---|---|
| Web | Cloudflare (Workers/Pages) | Lee solo de Turso |
| Perfiles, rankings y agregados | Turso | Pocas escrituras, lecturas baratas |
| Crawler + partidas en bruto | VM Oracle Cloud Always Free + DuckDB | Fase 2: calcula builds/matchups y sube los agregados a Turso |

## Hoja de ruta

1. ✅ Buscador por Riot ID, perfil (rango, historial, campeones) y rankings Maestro+
2. Crawler y agregados: builds, runas, matchups y tier list (Esmeralda+, EUW) → pedir production key
3. Diferenciadores: matchups personalizados (bayesiano global + tu historial), coach comparativo minuto a minuto, optimizador de pool
4. Partida en directo, más regiones y elos; resumen de partida con IA
