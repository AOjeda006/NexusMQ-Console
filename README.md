# NexusMQ Console

Consola web de **administración y monitorización** de [NexusMQ](https://github.com/AOjeda006/NexusMQ),
un broker de mensajería distribuido en C++23. Cliente **externo y remoto**: no toca el core del
broker — consume su **plano de operación REST** (contrato OpenAPI).

> Estado: **en desarrollo** (v1). El backend de NexusMQ ya expone todo el contrato necesario
> (topics CRUD + `PATCH`, groups describe, cluster, snapshot de métricas y SSE en vivo).

## Arquitectura

- **SPA** — React (Vite), TypeScript. Visualización con ECharts / uPlot / visx / react-three-fiber.
- **BFF** — NestJS. Proxya el plano admin del broker y Prometheus, confina el **JWT en servidor**,
  **termina el SSE** y sirve la SPA (mismo origen, sin CORS).
- **`packages/contract`** — cliente y tipos **generados** del `openapi.yaml` de NexusMQ (fuente de
  verdad). El contrato nunca se escribe a mano.

```
apps/web         SPA React (Vite)
apps/bff         BFF NestJS
packages/contract  tipos + cliente generados del OpenAPI de NexusMQ
```

## Requisitos

- Node **22 LTS**, **pnpm**.
- Un nodo NexusMQ alcanzable con el **plano de operación** activo (`--admin-port`), idealmente con
  `--jwt-secret` y TLS. Opcional: un **Prometheus** apuntando a `/metrics` para la historia.

## Puesta en marcha

```bash
pnpm install
pnpm --filter @nexusmq/contract generate   # genera tipos del OpenAPI
cp apps/bff/.env.example apps/bff/.env      # configura BROKER_ADMIN_URL, etc.
pnpm dev                                    # levanta BFF + SPA
```

## Scripts

| Comando | Efecto |
|---|---|
| `pnpm dev` | BFF + SPA en desarrollo |
| `pnpm build` | Build de producción de todo el monorepo |
| `pnpm test` | Tests (Vitest / Playwright / supertest) |
| `pnpm lint` · `pnpm typecheck` | Calidad estática |
| `pnpm --filter @nexusmq/contract sync:openapi` | Re-descarga el OpenAPI de NexusMQ |
| `pnpm --filter @nexusmq/contract generate` | Regenera tipos + cliente |

## Desarrollo asistido por agentes

Este repo sigue el **sistema de agentes Claude Code** de la biblioteca de convenciones:
`CLAUDE.md` (memoria + reglas), `AGENTS.md` (contrato de trabajo) y `docs/PLAN.md` (spec + checklist,
fuente de verdad del estado). El estado vive en disco para sobrevivir a `/compact`.

## Seguridad

JWT confinado en el BFF (nunca en el navegador), TLS en tránsito, validación en el borde,
autorización por recurso, errores RFC 7807. Detalle en `docs/PLAN.md` §Seguridad.

## Licencia

<<Definir — p. ej. PolyForm Noncommercial 1.0.0, igual que NexusMQ, o la que elijas.>>
