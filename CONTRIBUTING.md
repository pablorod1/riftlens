# Contribuir a Riftlens

¡Gracias por querer echar una mano! Puedes abrir issues y PRs en español o en inglés.

## Arrancar en 2 minutos (sin clave de Riot)

Necesitas [Bun](https://bun.sh) ≥ 1.4.

```bash
git clone https://github.com/pablorod1/riftlens.git
cd riftlens
bun install
cp .env.example .env
bun run db:push      # crea la base de datos local (data/riftlens.db)
bun run seed:demo    # carga datos ficticios
bun run dev          # http://localhost:3000/es/summoner/euw/Demo-EUW
```

Con `seed:demo` tienes un perfil, un ranking y una tier list ficticios (`/es/champions`): suficiente para trabajar en casi toda la interfaz.

### Con datos reales

1. Crea una cuenta en [developer.riotgames.com](https://developer.riotgames.com) y copia tu *Development API Key* (caduca cada 24 h).
2. Pégala en `RIOT_API_KEY` dentro de `.env`.
3. `bun run dev` y busca cualquier Riot ID. Para el ranking: `bun run worker:ladder`.

La clave de desarrollo permite 100 peticiones cada 2 minutos y la comparten la web y el worker (ver `RIOT_WEB_SHARE` / `RIOT_WORKER_SHARE`).

## Mapa del código

| Carpeta | Qué hay |
|---|---|
| `apps/web` | Next.js 16 (App Router con Cache Components). Rutas en `src/app/[lang]` |
| `apps/web/src/i18n` | Diccionarios `es.ts` (referencia) y `en.ts` |
| `apps/worker` | Procesos en segundo plano: ranking, seed de demo |
| `packages/riot` | Cliente de la API de Riot + Data Dragon |
| `packages/db` | Esquema Drizzle (SQLite en local, Turso en producción) |
| `packages/core` | Lógica compartida: perfiles, ranking, estadística |

> **Next.js 16 tiene cambios grandes** respecto a versiones anteriores (Cache Components, `proxy.ts`, `next/root-params`…). La documentación de la versión instalada está en `apps/web/node_modules/next/dist/docs/`.

## Reglas de la casa

- **Textos visibles siempre en los diccionarios**, nunca escritos en el JSX. Añade la clave en `es.ts` y en `en.ts` (TypeScript avisa si falta).
- **Nada de secretos en el repo:** ni claves (`RGAPI-…`), ni `.env`, ni bases de datos, ni datos personales de jugadores reales en tests o capturas. Usa `seed:demo` para capturas.
- **Estadística honesta:** si muestras un winrate, muestra también el tamaño de la muestra o su intervalo (`wilson()` en `packages/core/src/stats.ts`).
- **Diseño:** casi monocromo; el color solo donde aporta información. Reutiliza los tokens de `apps/web/src/app/globals.css`.
- Respeta las [políticas de desarrolladores de Riot](https://developer.riotgames.com/policies/general).

## Antes de abrir un PR

```bash
bun run typecheck
bun run --cwd apps/web lint
bun run build
```

La CI ejecuta lo mismo. PRs pequeños y enfocados se revisan antes; si es un cambio grande, abre primero un issue para comentarlo.

## Dónde empezar

Busca issues con la etiqueta [`good first issue`](https://github.com/pablorod1/riftlens/labels/good%20first%20issue).
