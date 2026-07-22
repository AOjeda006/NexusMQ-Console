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
pnpm --filter @nexusmq/contract generate     # genera tipos del OpenAPI
# Config del BFF (ver .env.example). En dev basta exportar lo esencial:
export BROKER_ADMIN_URL=http://localhost:8080 SESSION_SECRET="$(openssl rand -hex 32)"
pnpm dev                                      # levanta BFF + SPA
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

## Despliegue (Docker)

La consola se empaqueta en **una sola imagen**: el BFF NestJS que **sirve la SPA** ya construida
(mismo origen). El broker NexusMQ y Prometheus son **externos** y se apuntan por variables de entorno.

### Configuración (variables de entorno)

Los secretos van **siempre por entorno**, nunca horneados en la imagen. Plantilla en `.env.example`.

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `SESSION_SECRET` | **Sí** | — | Firma la cookie de sesión httpOnly. **≥32 caracteres** (`openssl rand -hex 32`). |
| `SESSION_TTL_HOURS` | No | `8` | TTL de la sesión de operador. Vencida, el BFF la purga y exige re-login. |
| `CONSOLE_REQUIRE_LOGIN` | No | `true` | Si `true`, la consola exige login **siempre** (aunque el broker esté en modo abierto). `false` espeja el modo del broker. |
| `BROKER_ADMIN_URL` | **Sí** | — | URL del plano de operación (admin) del broker NexusMQ. |
| `PROMETHEUS_URL` | No | — | Data source de historia. Sin él, la vista de Historia **degrada limpio**. |
| `PORT` | No | `3000` | Puerto en el que escucha la consola. |
| `NODE_ENV` | No | `production` (en la imagen) | `production` ⇒ cookie `Secure` (requiere TLS) + HSTS. |
| `BROKER_TLS_REJECT_UNAUTHORIZED` | No | `true` | Validar el certificado TLS del broker al proxyar. |
| `NODE_EXTRA_CA_CERTS` | No | — | CA adicional para el TLS del broker (ruta a PEM). |
| `WEB_DIST_PATH` | No | `/app/web` (en la imagen) | Dónde está el build de la SPA a servir. |

### Imagen

```bash
docker build -t nexusmq-console:1.0.0 .
docker run --rm -p 3000:3000 \
  -e BROKER_ADMIN_URL=http://broker:8080 \
  -e PROMETHEUS_URL=http://prometheus:9090 \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  nexusmq-console:1.0.0
```

Imagen **multi-stage** (compila el monorepo, ejecuta solo el artefacto), **usuario no-root** y con
**`HEALTHCHECK`** propio (`/health`). El artefacto de runtime son las deps de producción del BFF + su
`dist` + el build de la SPA.

### docker-compose (ejemplo)

`docker-compose.yml` levanta **console + broker + prometheus** (con `deploy/prometheus.yml`):

```bash
export SESSION_SECRET="$(openssl rand -hex 32)"
docker compose up --build          # consola en http://localhost:3000
```

> El servicio `broker` es un **placeholder**: sustituye su `image:` por la del broker NexusMQ real
> (expone el plano admin y `/metrics`). El resto funciona tal cual.

### Producción y TLS

La consola habla **HTTP en claro** dentro de su red; **termina TLS en un proxy inverso** delante
(nginx/Traefik/ingress). Con `NODE_ENV=production` la cookie de sesión es `Secure` (solo viaja por
HTTPS) y se emite **HSTS**, así que sírvela **siempre tras HTTPS** en producción. `GET /health`
(liveness) y `GET /readyz` (readiness, vía el broker) sirven para las *probes* del orquestador.

## Seguridad

Defensa en profundidad, con el BFF como único punto que habla con el broker:

- **JWT confinado en el servidor.** El operador pega su token; el BFF lo valida y lo guarda en
  servidor. Al navegador solo va una cookie de sesión **httpOnly** (`SameSite=Lax`, `Secure` en prod),
  firmada por HMAC. El token del broker **nunca** aparece en una respuesta al navegador (hay tests que
  lo garantizan).
- **Mismo origen, sin CORS.** El BFF sirve la SPA y la API en el mismo origen; **no** habilita CORS,
  así que el navegador bloquea las lecturas cross-origin.
- **Cabeceras de seguridad** en toda respuesta: **CSP** anclada a `'self'` (con el *hash* del único
  script inline del index, sin `unsafe-inline` en scripts), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`,
  aislamiento de origen (COOP/CORP) y **HSTS** en producción; sin `X-Powered-By`.
- **Validación en el borde** (Zod, *allow-list*) de toda entrada: paginación, nombres, `PATCH` de
  retención `.strict()`, parámetros de `query_range`, token de login. Errores **RFC 7807**, sin
  filtrar detalles internos.
- **Anti-SSRF.** El destino del broker y de Prometheus se fija por entorno (confinado en el servidor):
  el navegador **no** puede redirigir el BFF a hosts arbitrarios.
- **Imagen no-root**, secretos por entorno (nunca horneados), TLS en tránsito (proxy inverso).

## Licencia

<<Definir — p. ej. PolyForm Noncommercial 1.0.0, igual que NexusMQ, o la que elijas.>>
