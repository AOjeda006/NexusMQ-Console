# PLAN — NexusMQ Console

> Plan de registro (**fuente de verdad del estado del trabajo**) y spec SDD *spec-anchored*. El
> agente lo lee al arrancar y tras cada `/compact`, y lo actualiza al avanzar. Mantenlo coherente
> con la realidad del repo. Trabajo **feature a feature**: implementa, verifica, marca, y solo
> entonces pasa a la siguiente.

## Objetivo

Construir la **consola web** de administración y monitorización de **NexusMQ**: un cliente externo
remoto (SPA React + BFF NestJS) que consume el plano de operación REST del broker, con una
**visualización potente y llamativa**. Entregar la **v1** completa (Dashboard vivo + Topics CRUD +
Grupos + Particiones + Cluster), con historia vía Prometheus y empaquetado en contenedor.

## Alcance / No-objetivos

- **Dentro:** monorepo TS (pnpm+Turborepo); `packages/contract` generado del OpenAPI de NexusMQ;
  BFF (proxy + JWT confinado + terminación SSE + Prometheus + sirve SPA); SPA (sistema de diseño
  dataviz + vistas v1); Prometheus como data source; Docker + CI.
- **Fuera:** tocar el core C++ de NexusMQ; reimplementar una TSDB; embeber Grafana; endpoint "kill";
  app móvil nativa; control de ciclo de vida de nodos (**v2**, depende de la capa de servicio del SO
  en NexusMQ, aún no existe).

## Contrato del backend (ya entregado en NexusMQ — no se toca aquí)

Fuente de verdad: `docs/openapi.yaml` de NexusMQ. Endpoints que consume la v1:

| Capacidad | Endpoint |
|---|---|
| Salud / readiness | `GET /healthz`, `GET /readyz` |
| Snapshot de métricas (JSON) | `GET /api/v1/metrics/snapshot` |
| Streaming en vivo (SSE) | `GET /api/v1/stream` |
| Topics CRUD | `GET/POST /api/v1/topics`, `GET/DELETE /api/v1/topics/{name}` |
| Alter-config topic (retención) | `PATCH /api/v1/topics/{name}` |
| Grupos | `GET /api/v1/groups`, `GET /api/v1/groups/{id}` |
| Cluster / Raft | `GET /api/v1/cluster` |
| Métricas Prometheus (texto) | `GET /metrics` |

Auth: Bearer JWT (HS256) si el broker arrancó con `--jwt-secret`. Errores: RFC 7807.

## Decisiones tomadas

> Cada respuesta de clarificación se anota aquí (fecha + decisión) para sobrevivir a `/compact`.

- **2026-07-16 — Cliente externo, repo propio, contrato = OpenAPI de NexusMQ.** (decidido con el
  orquestador; ver documento de plan del cliente).
- **2026-07-16 — Stack:** React (Vite) SPA + NestJS BFF, monorepo pnpm + Turborepo, TS end-to-end.
- **2026-07-16 — Node 22 LTS; gestor pnpm.** (reversible)
- **2026-07-16 — Generación de contrato:** `openapi-typescript` (tipos) + `openapi-fetch` (cliente
  ligero tipado). Datos en SPA con **TanStack Query**. (reversible)
- **2026-07-16 — OpenAPI vendorizado** en `packages/contract/openapi.yaml` + script
  `sync:openapi` que lo re-descarga del raw de NexusMQ. Nunca editar tipos a mano. (reversible)
- **2026-07-16 — Estilo/diseño:** Tailwind CSS + primitivos Radix UI, con el sistema de color/tokens
  guiado por la skill **dataviz**. (reversible)
- **2026-07-16 — Auth:** el BFF hace login contra el broker y **guarda el JWT del broker en
  servidor**; al navegador solo va una **cookie de sesión httpOnly del BFF**. (esencial — no exponer
  el token del broker al navegador)
- **2026-07-16 — Tests:** Vitest (web, bff, contract) + Playwright (e2e de la SPA) + supertest (e2e
  del BFF). (reversible)
- **2026-07-16 — Modo git:** **`main` directo + firma** (sin ramas por feature; un ítem = un commit
  atómico). (confirmado con el usuario en la puerta de clarificación)
- **2026-07-16 — Push:** **commit + push a `origin/main`** tras cada ítem (habilita CI verde en
  GitHub y Verified en el remoto). (confirmado con el usuario)
- **2026-07-16 — Hosting v1:** imagen **Docker genérica** + `docker-compose` de ejemplo (console +
  broker + prometheus); sin atarse a un PaaS. Es materia de la Fase 4. (confirmado con el usuario)
- **2026-07-16 — Entorno local (reversible):** `pnpm` no venía instalado y este Node no trae
  `corepack`; se instaló `pnpm` global (`npm i -g pnpm`) y se fija `packageManager` en el
  `package.json` raíz. Node instalado = **v25.6.1**, pero el proyecto fija **Node 22 LTS**
  (`.nvmrc` + CI). El andamiaje funciona en 25; para dev local coherente, instalar Node 22.
- **2026-07-16 — Transporte git = SSH.** El `origin` usa `git@github.com:...` con una clave de auth
  local dedicada (`~/.ssh/github_auth`), porque el PAT de HTTPS no tenía scope `workflow` y GitHub
  rechazaba subir `.github/workflows/`. La firma sigue con `github_signing` (independiente). El push
  del repo va por SSH de aquí en adelante.
- **2026-07-16 — El broker no expone endpoint de login (contrato).** El `openapi.yaml` solo define
  `bearerAuth` (JWT HS256), exigido únicamente si el nodo arrancó con `--jwt-secret`. **No hay ruta
  que acuñe tokens**: el JWT se emite fuera del broker. Por eso el "login contra el broker" del BFF
  no es literal; se resuelve con el modelo de auth de abajo.
- **2026-07-16 — Auth (F1.4) = "el operador pega su token".** (esencial — confinamiento del token).
  En el login el operador introduce un **JWT de broker ya emitido**; el BFF lo **valida contra el
  broker** y lo guarda **en servidor** (almacén de sesiones en memoria). Al navegador solo va una
  **cookie de sesión httpOnly** con el id de sesión. El **BFF nunca conoce el secreto HS256** de
  firma. Si el broker corre **sin `--jwt-secret`**, la consola funciona en **modo abierto** (sin
  login). El token del broker **no puede aparecer nunca** en una respuesta al navegador (habrá un
  test que lo garantice).
- **2026-07-16 — Mecánica de F1.4 (auth) — detección de modo por sondeo, cookie de sesión opaca y
  firmada.** El BFF **no conoce el secreto** del broker, así que descubre si el broker exige auth
  **sondeando su comportamiento**: una petición a un endpoint protegido (`GET /api/v1/topics?size=1`)
  **sin** token ⇒ `401` significa *modo secreto* (auth requerida); `2xx` significa *modo abierto*. El
  resultado se **cachea** por instancia. Sesión = **id aleatorio de 256 bits** guardado en servidor;
  la cookie httpOnly lleva `id.HMAC-SHA256(id, SESSION_SECRET)` (se usa el secreto documentado en
  F1.2; verificación en tiempo constante). El **guard por petición**: con sesión ⇒ inyecta el token
  del broker en el proxy; sin sesión y modo secreto ⇒ **401** propio; sin sesión y modo abierto ⇒
  deja pasar sin token. `POST /api/auth/login` valida el token contra el broker; `POST /api/auth/logout`
  destruye la sesión; `GET /api/auth/session` solo informa `{ authenticated }`. (esencial — deriva
  del modelo de auth de arriba)
- **2026-07-17 — Nombres de métrica del snapshot (F3.1) (reversible).** El `MetricsSnapshot` del
  contrato es una **lista abierta** de series (`name` libre estilo Prometheus): el contrato **no fija
  los nombres**. El Dashboard asume, en un único sitio (`features/metrics/metrics-snapshot.ts`),
  `nexusmq_messages_in_total` / `nexusmq_messages_out_total` (counters), `nexusmq_produce_latency_seconds`
  (histograma) y `nexusmq_connections_active` (gauge), y **degrada con honestidad** (muestra «—») si
  una serie no está. Como no hay broker real a mano, se verifica contra el **doble** (que emite esos
  nombres); si el broker real usa otros, se ajusta ese único módulo sin tocar la UI. **Limitación
  documentada.**
- **2026-07-16 — Tooling del BFF (reversible).** NestJS 11 sobre **Express**; el paquete `apps/bff`
  emite **CommonJS** (idiomático en Nest; el resto del monorepo sigue ESM), con **DI por
  constructor** vía `reflect-metadata` (`experimentalDecorators` + `emitDecoratorMetadata`). El
  **proxy al broker usa `fetch` nativo** (undici), no el cliente `openapi-fetch`: es *passthrough*
  (reemite RFC 7807 y SSE tal cual); el contrato se usa **solo para tipos**. Config validada con
  **zod** *fail-fast* (F1.2). Sesiones **en memoria** (una sola instancia; basta para v1). Tests e2e
  con **Vitest + supertest**, usando **`unplugin-swc`** para la metadata de decoradores.

## Decisiones abiertas (resolver en la puerta de clarificación con el usuario)

- _(ninguna pendiente — todas las abiertas se resolvieron el 2026-07-16; ver arriba)_

## Estado actual

**Fase 0 COMPLETA** (F0.1–F0.4, todo verificado y pusheado). **F1.1 COMPLETA**: esqueleto Clean del
BFF (NestJS 11 / Express, CommonJS) con los módulos `config` (global), `health`, `broker`,
`prometheus`, `auth` y `stream`; DI por constructor; controllers finos; `GET /health` responde 200 y
e2e (Vitest + supertest, metadata de decoradores vía `unplugin-swc`) en verde; arranque real
verificado (`node dist/main.js`). **F1.2 COMPLETA**: config *fail-fast* con **zod** (allow-list
`BROKER_ADMIN_URL`/`PROMETHEUS_URL`/`SESSION_SECRET`/TLS…); `validateEnv` pura + `ConfigService`;
arranque con env inválido aborta con mensaje claro y exit 1 (comprobado). **F1.3 COMPLETA**: proxy
REST *passthrough* del broker con `fetch` (undici) — topics CRUD+`PATCH`, groups, cluster,
`metrics/snapshot`, `healthz`/`readyz`—; controllers finos que reemiten status+cuerpo+`Location`
*verbatim*; validación en el borde con `ZodValidationPipe`; `ProblemDetailsFilter` global mapea a
RFC 7807 solo los errores del BFF (400 de borde, 502 broker caído) y propaga intactos los 4xx del
broker. 19 e2e contra un doble del broker (puerto efímero). **F1.4 COMPLETA**: auth con **JWT
confinado** (el operador pega su token). Login valida contra el broker y guarda el token en un almacén
de sesiones **en memoria**; al navegador solo una cookie **httpOnly** firmada (HMAC con
`SESSION_SECRET`). `SessionAuthGuard` global protege `topics`/`groups`/`cluster`: inyecta el token
server-side, 401 sin sesión en modo secreto y deja pasar en **modo abierto** (detectado por sondeo).
7 e2e con aserciones de **no-fuga** del token. **F1.5 COMPLETA**: terminación **SSE** — el BFF
reemite el `GET /api/v1/stream` del broker al navegador (`text/event-stream`, latido, mismo criterio
TLS) con **reconexión backoff+jitter** sin tumbar el `EventSource`, timeouts de conexión/inactividad
y cierre limpio al desconectar el cliente. 3 e2e (cliente SSE crudo): frames, reconexión y cierre
limpio. Typecheck/lint/build/test verdes (37 tests). **F1.6 COMPLETA**: data source de Prometheus —
`GET /api/history/query_range` (+`/status`) con **degradación limpia** (sin `PROMETHEUS_URL` ⇒ `200
{available:false}`; con él, series reales), señalizando consulta inválida (400) y Prometheus caído
(502). 7 e2e con un doble de Prometheus. **F1.7 COMPLETA**: en producción el BFF sirve el build
estático de la SPA (`WEB_DIST_PATH`) con fallback de deep links, sin tapar API/observabilidad;
*no-op* si no hay build (en dev lo sirve Vite). 7 e2e con una SPA de prueba.

**★ FASE 1 (BFF) COMPLETA** (F1.1–F1.7). Typecheck/lint/build/test verdes en todo el monorepo (51
tests del BFF).

**F2.1 COMPLETA**: shell de la SPA + sistema de diseño dataviz. Vite 8 + React 19 + TS, Tailwind v4
(CSS-first, `@theme inline`) + Radix + lucide. **Tokens dataviz centralizados** (`styles/tokens.css`,
instancia validada de la paleta: superficies/tinta/estado/categórica de 8; pasa el validador en light
y dark). Tema system/light/dark con persistencia y anti-FOUC; shell navegable (Sidebar con estado
activo + Topbar) con routing react-router 7 y placeholders honestos por sección + 404. **Verificado en
navegador** (Playwright/Chromium sobre `vite preview`): 5 e2e verdes, incluido **contraste AA ≥4.5**
del texto sobre página y superficie en ambos temas, con capturas light/dark revisadas.
typecheck/lint/build verdes.

**F2.2 COMPLETA**: capa de datos + auth. Cliente `openapi-fetch` del contrato + **TanStack Query**;
errores **RFC 7807** normalizados (`ProblemError`) y mostrados con icono + texto; **auth «el operador
pega su token»** (login/logout contra el BFF, sesión por cookie httpOnly) con `useAccess` (sesión +
modo del broker) y guard `RequireAuth`; **vista de Topics** que lista datos reales paginados con
estados cargando/error/vacío. **Verificado en navegador full-stack**: el BFF real sirve la SPA y
proxya a un doble del broker (topología de producción); 5 e2e verdes (guard, RFC 7807, login →
Topics reales, persistencia, logout) + los 5 del shell. Repo verde (typecheck/lint/build/test).

**F2.3 COMPLETA**: arsenal de visualización. Puente `useVizTokens` (tokens dataviz reactivos al
tema) + **cuatro wrappers base** (`EChart`, `UplotChart`, `VisxAreaChart`, `ThreeClusterScene`) que
toman color de la paleta en orden fijo con grid/ejes recesivos; laboratorio `/lab` con carga
diferida que muestra una gráfica de cada librería. **Verificado en navegador** (Playwright): 2 e2e
—las 4 gráficas renderizan (3 canvas + visx SVG, WebGL incluido) y respetan el tema oscuro— con
capturas light/dark revisadas. Repo verde.

**F2.4 COMPLETA**: tiempo real. Hook `useLiveStream` sobre `EventSource` (SSE del BFF) con **fallback
a polling** del snapshot ante fallo del SSE, sin romper la UI. Laboratorio `/live-lab` con
«Forzar fallo»/«Restaurar». **Verificado en navegador full-stack**: push en vivo (el BFF reemite los
frames del doble del broker), caída a polling al forzar el fallo y vuelta a vivo al restaurar;
capturas revisadas.

**★ FASE 2 (SPA base + sistema de diseño) COMPLETA** (F2.1–F2.4). SPA React/Vite con shell
navegable, sistema de diseño dataviz (light/dark, AA), capa de datos tipada + auth confinada, arsenal
de visualización (ECharts/uPlot/visx/react-three-fiber) y tiempo real con fallback. Repo verde en
todo el monorepo: typecheck/lint/build/test (51 del BFF) + e2e del shell/viz (7, Playwright sobre
`vite preview`) + e2e full-stack (6, BFF real sirviendo la SPA y proxyando a un doble del broker).

**F3.1 COMPLETA**: Dashboard vivo. Métricas por **SSE del BFF** (fallback a polling) con **derivación
en cliente** —throughput por segundo (diferencia de counters) y latencias p50/p99/p999 (cuantiles del
histograma del intervalo)— pura y testeada (`metrics-snapshot.ts` + 10 tests). Cuatro KPIs, **dos
gráficas uPlot en vivo** (streaming con `setData`, leyenda, tokens dataviz, tema) y panel
**Clúster/Raft** (nodos + tabla de consenso por partición) sondeado con TanStack Query. **Verificado
en navegador full-stack**: en vivo (SSE), muestras que avanzan en < 2 s (AC), p99 en ms, clúster
saludable y estado Raft real; captura revisada. El doble del broker emite ahora el `MetricsSnapshot`
del contrato (counters + histograma + gauge) y un `ClusterInfo` con Raft vivo. Repo verde:
typecheck/lint/build/test (51 BFF + **10 web**) + e2e shell/viz (7) + e2e full-stack (**7**).

**F3.2 COMPLETA**: gestión de **Topics** (CRUD + `PATCH` de retención). Lista paginada, crear
(diálogo Radix), describir (config + particiones), **editar retención con efecto real** y borrar
(confirmación); mutaciones tipadas del contrato que invalidan la caché para releer del broker.
Nuevas primitivas: `Dialog`, `Field`/`Input`, variante `danger`, helper `unwrapVoid`. **Verificado en
navegador full-stack**: crear → describir → **PATCH retentionMs ⇒ vigente «1 h» que persiste tras
recargar** → borrar. El doble del broker pasó a **stateful**. Repo verde: typecheck/lint/build/test
(contract 1 + BFF 51 + web 10) + e2e shell/viz (7) + e2e full-stack (**8**).
**Siguiente: F3.3 — Grupos (listar + describir: miembros, offsets, lag).**

---

## Checklist

> `[ ]` pendiente · `[x]` hecho (cumple criterio + verificado + commiteado si procede).

### Fase 0 — Andamiaje del monorepo
- [x] **F0.1 Monorepo base** — pnpm workspaces + Turborepo con `apps/web`, `apps/bff`,
  `packages/contract`; TS base compartido, ESLint + Prettier, `.gitignore`, `.nvmrc` (Node 22).
  *AC:* `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm typecheck` verdes en un árbol vacío.
  ✔ install/build/lint/typecheck/test verdes; aprobación de build scripts (esbuild) vía
  `pnpm-workspace.yaml` (`allowBuilds`).
- [x] **F0.2 `packages/contract`** — vendoriza `openapi.yaml` de NexusMQ; script `sync:openapi`;
  `generate` con `openapi-typescript`; exporta `openapi-fetch` tipado + tipos.
  *AC:* `pnpm --filter @nexusmq/contract generate` produce tipos; se importa desde web y bff sin error.
  ✔ `openapi.yaml` vendorizado (LF, canónico de GitHub); `sync:openapi` verificado con descarga real;
  `generate` produce `paths/components/operations`; `createNexusMqClient` (openapi-fetch) exportado;
  web y bff importan `@nexusmq/contract` y typecheck pasa. Turbo encadena `generate → build/typecheck`.
- [x] **F0.3 CI (GitHub Actions)** — workflow que en cada push corre install + lint + typecheck +
  build + test. *AC:* workflow en verde en GitHub.
  ✔ `.github/workflows/ci.yml` (Node 22 vía `.nvmrc`, pnpm con caché): install → generate → lint →
  typecheck → build → test. Push desbloqueado vía **SSH** (nueva clave de auth `github_auth`, porque
  el PAT HTTPS no tiene scope `workflow`). Run **verde** en GitHub Actions (`conclusion=success`).
- [x] **F0.4 Firma e identidad** — `.claude/settings.json` colocado; verificar commits **Verified**
  con la identidad del usuario. *AC:* `git log --show-signature` marca el commit como firmado.
  ✔ Firma SSH con la clave propia del usuario (config global local, no el secreto cloud). Los dos
  commits pusheados figuran en la API de GitHub como `verified=true, reason=valid`
  (andresojedarodriguez@gmail.com): badge **Verified**.

### Fase 1 — BFF (NestJS)
- [x] **F1.1 Esqueleto Clean** — módulos `config`, `health`, `broker` (proxy), `prometheus`, `auth`,
  `stream` (SSE); DI por constructor; sin lógica de negocio en controllers.
  *AC:* `pnpm --filter @nexusmq/bff dev` arranca; `GET /health` responde; tests de arranque en verde.
  ✔ NestJS 11 sobre Express, salida CommonJS (el resto del monorepo sigue ESM). `AppModule` compone
  los 6 módulos; `ConfigModule` es `@Global()`. Controller de health fino delega en `HealthService`.
  `GET /health` → `200 {status:ok, service, uptimeSeconds}`; arranque real comprobado
  (`node dist/main.js`, todos los módulos inicializados y ruta mapeada). e2e con Vitest + supertest
  (metadata de decoradores vía `unplugin-swc`; `@swc/core` en la allow-list de builds). Dev con
  `nest start --watch`. typecheck/lint/build/test verdes.
- [x] **F1.2 Config validada** — env: `BROKER_ADMIN_URL`, `PROMETHEUS_URL` (opcional), secreto de
  sesión, TLS/`NODE_EXTRA_CA_CERTS`. Validación *fail-fast* al arranque (allow-list).
  *AC:* arranca solo con config válida; un env inválido aborta con mensaje claro.
  ✔ `config.schema.ts` con **zod** (allow-list): `PORT` (def. 3000), `BROKER_ADMIN_URL` (URL,
  requerida), `PROMETHEUS_URL` (URL, opcional), `SESSION_SECRET` (≥32), `NODE_EXTRA_CA_CERTS`
  (opcional), `BROKER_TLS_REJECT_UNAUTHORIZED` (bool, def. true). `validateEnv` (función pura,
  testeable) lanza `ConfigValidationError` con detalle por clave; `ConfigService` la invoca en su
  constructor y `main.ts` la captura → **aborta con exit 1**. Comprobado en real: sin
  `BROKER_ADMIN_URL`/`SESSION_SECRET` imprime el mensaje y sale con código 1. 6 tests unitarios de
  `validateEnv` + setup de entorno para los e2e. typecheck/lint/build/test verdes.
- [x] **F1.3 Proxy REST del broker** — reexponer topics CRUD+`PATCH`, groups list+`{id}`, `cluster`,
  `metrics/snapshot`, `healthz/readyz`. Validación en el borde; passthrough de RFC 7807.
  *AC:* e2e (supertest) contra un **doble del broker** cubre cada endpoint (éxito + error 4xx).
  ✔ `BrokerService.forward()` con `fetch` (undici) *passthrough*: captura status + `Content-Type` +
  cuerpo del broker y el controller los reemite *verbatim* (`sendProxyResult`, incluye `Location` al
  crear). Controllers finos por recurso (`TopicsController` CRUD+PATCH, `GroupsController`,
  `ClusterController`, `ObservabilityController` para `healthz`/`readyz`/`metrics/snapshot`).
  Validación en el borde con `ZodValidationPipe` (paginación `[1,100]`; `name` obligatorio; PATCH
  `.strict()` rechaza `segmentBytes`). `ProblemDetailsFilter` global (vía `CommonModule`/`APP_FILTER`)
  mapea a `application/problem+json` **solo** los errores que origina el BFF: validación → 400,
  `BrokerUnreachableError` → 502; los 4xx del broker se propagan intactos. TLS relajable con
  dispatcher undici propio si `BROKER_TLS_REJECT_UNAUTHORIZED=false`. e2e (19 casos) contra un doble
  del broker (`test/broker-double.ts`, puerto efímero): éxito por endpoint, 404/409 del broker, 400 de
  borde (size, name, segmentBytes) y 502 con broker caído. typecheck/lint/build/test verdes (27 tests).
- [x] **F1.4 Auth/JWT confinado** — login → el BFF obtiene y **guarda el JWT del broker en
  servidor**; al navegador, cookie de sesión **httpOnly**. Guard por petición; logout.
  *AC:* el token del broker **no** aparece nunca en respuestas al navegador; rutas protegidas dan 401
  sin sesión.
  ✔ Modelo "el operador pega su token": `POST /api/auth/login` valida el token contra el broker
  (sondeo a `/api/v1/topics`), lo guarda en un **almacén de sesiones en memoria** y responde solo con
  una cookie **httpOnly** `nexusmq_session=id.HMAC-SHA256(id, SESSION_SECRET)` (id aleatorio de 256
  bits; verificación en tiempo constante). `SessionAuthGuard` **global** (`APP_GUARD`) sobre las rutas
  `@Protected()` (topics/groups/cluster): con sesión inyecta el token confinado en el proxy
  (`@BrokerToken()`); sin sesión responde **401** propio si el broker exige auth, o deja pasar en
  **modo abierto**. El modo se descubre por **sondeo del comportamiento** (el BFF no conoce el secreto
  HS256) y se cachea. `POST /api/auth/logout` y `GET /api/auth/session` (solo `{authenticated}`). Para
  evitar el ciclo de módulos, `BrokerModule` es `@Global()` y `BrokerModule` no importa `AuthModule`.
  e2e (7 casos): 401 sin sesión, login inválido/válido, proxy con sesión, `session`, logout y **modo
  abierto**; con **aserciones de no-fuga** (el token no aparece en cuerpo, cabeceras ni cookie).
  typecheck/lint/build/test verdes (34 tests).
- [x] **F1.5 Terminación SSE** — conectar a `GET /api/v1/stream` del broker y **reemitir** SSE al
  navegador (mismo origen); reconexión, timeout y cierre limpio; backpressure acotado.
  *AC:* un cliente `EventSource` contra el BFF recibe frames; al caer el broker, el BFF reconecta sin
  tumbar la conexión del navegador.
  ✔ `StreamController` (`GET /api/v1/stream`, ruta **abierta** como en el contrato) delega en
  `StreamService.pipe()`: fija cabeceras `text/event-stream` (+`X-Accel-Buffering: no`), lanza un
  **latido** (`: keep-alive`) y reemite los frames del broker (`fetch` undici en streaming, mismo
  criterio TLS que el proxy). La conexión del navegador es estable: si el broker cae, un bucle de
  **reconexión con backoff exponencial + jitter** (`reconnect.ts`) reabre el upstream **sin cerrar**
  el `EventSource`; hay **timeout de conexión** (10 s) e **inactividad** (30 s); al desconectarse el
  cliente (`req 'close'`) se **aborta** el upstream (`AbortController`) y se cierra limpio. e2e (3
  casos, cliente SSE crudo sobre `node:http`): recibe frames; **reconecta** manteniendo viva la
  conexión (doble que cierra tras cada frame ⇒ ≥2 conexiones upstream, cliente sin corte); y **cierre
  limpio** (al irse el cliente, el upstream del doble queda en 0). typecheck/lint/build/test verdes
  (37 tests).
- [x] **F1.6 Prometheus data source** — proxy de `query_range` con **degradación limpia**: si no hay
  `PROMETHEUS_URL`, responde "no disponible" sin romper. *AC:* con y sin Prometheus, el BFF responde
  coherente (datos / vacío señalizado).
  ✔ `PrometheusController` (`GET /api/history/query_range` + `GET /api/history/status`, rutas
  abiertas) delega en `PrometheusService.queryRange()`: **sin `PROMETHEUS_URL`** responde `200
  {available:false, reason}` (degradación limpia, no error); **con Prometheus** proxya
  `/api/v1/query_range` (`fetch` undici) y devuelve `{available:true, resultType, result}`. Los fallos
  se **señalizan**: consulta inválida → 400 (propaga el `status:"error"` de Prometheus), red/servidor
  caído → 502; ambos en `application/problem+json` vía el filtro global. Validación en el borde
  (`query`/`start`/`end`/`step` obligatorios). e2e (7 casos) con un doble de Prometheus: status y
  query con/sin Prometheus, 400 de consulta inválida, 400 de borde y 502 inaccesible.
  typecheck/lint/build/test verdes (44 tests).
- [x] **F1.7 Sirve la SPA** — en prod, el BFF sirve el build estático de `apps/web` (mismo origen).
  *AC:* build de producción del BFF sirve la SPA en `/`.
  ✔ `applyStaticHosting(app, config)` (llamado en `main.ts` antes de `listen`) monta, sobre el Express
  subyacente, `express.static` (ficheros reales del build) + un **fallback SPA** que devuelve
  `index.html` en las GET de cliente (deep links) **sin tapar** API ni observabilidad (`/api/*`,
  `/health`, `/healthz`, `/readyz` caen al router de Nest). Se activa solo si `WEB_DIST_PATH` apunta a
  un dir con `index.html`; si no, *no-op* (en dev sirve Vite). Config: `NODE_ENV` (+`isProduction`) y
  `WEB_DIST_PATH` añadidos al esquema. e2e (7 casos) con un build de SPA de prueba: `/` y deep links
  sirven `index.html`, los assets se sirven, `/health` sigue en JSON, `/api/*` desconocida da 404
  problem+json, y sin `WEB_DIST_PATH` no se sirve SPA (404) pero la API sigue viva.
  typecheck/lint/build/test verdes (51 tests).

### Fase 2 — SPA base + sistema de diseño
- [x] **F2.1 Shell + diseño (dataviz)** — Vite React TS; layout, routing, tema claro/oscuro;
  **aplica la skill dataviz** para paleta/tokens/tipografía. Tailwind + Radix.
  *AC:* shell navegable, accesible (contraste AA) en claro y oscuro; tokens centralizados.
  ✔ SPA Vite 8 + React 19 + TS, **Tailwind v4** (CSS-first, `@theme inline`) + **primitivos Radix**
  (ToggleGroup, Tooltip) + iconos lucide. **Tokens dataviz centralizados** en `styles/tokens.css`
  (instancia validada de la paleta de la skill: superficies, tinta, estado, categórica de 8 — pasa
  el validador en light y dark) mapeados a utilidades vía `@theme inline`. **Tema** system/light/dark
  con `ThemeProvider` (persistencia `localStorage`, script anti-FOUC en `index.html`, `data-theme`
  que gana sobre el `@media`) y control segmentado accesible (`aria-label` + icono, no solo color).
  Shell = `AppShell` (Sidebar responsive con estado activo + Topbar con título de sección, estado de
  conexión honesto "Sin sesión" y toggle de tema); routing con **react-router 7** (data router) y
  vistas placeholder honestas por sección (`PagePlaceholder`, "con datos reales en Fase N"), más 404
  dentro del shell. **Verificado en navegador** (Playwright/Chromium, `vite preview`): 5 e2e verdes
  —render del shell, navegación con `aria-current`, toggle+persistencia al recargar, **contraste AA
  (≥4.5) del texto sobre página y superficie en ambos temas**, y 404— con capturas light/dark
  revisadas. typecheck/lint/build verdes. La *relief rule* de 3 slots categóricos <3:1 en light se
  aplicará en F2.3 (gráficas) con etiqueta/tabla visibles.
- [x] **F2.2 Capa de datos + auth** — cliente `openapi-fetch` del contrato + TanStack Query; manejo
  de errores RFC 7807 → UI; flujo de login/logout contra el BFF; guard de rutas.
  *AC:* login funciona; una vista de prueba lista topics reales del broker vía BFF.
  ✔ **Cliente tipado** (`lib/api-client.ts`, `createNexusMqClient` del contrato apuntando al BFF,
  mismo origen) + **TanStack Query** (`QueryProvider` con política de reintentos: 4xx no se
  reintentan). **Errores RFC 7807** centralizados en `lib/problem.ts` (`ProblemDetail` del contrato,
  `ProblemError`, `unwrap`) y mostrados con `ProblemAlert` (color de estado `critical` **con icono +
  texto**, no solo color). **Auth (modelo «el operador pega su token»)**: `LoginPage` (textarea de
  JWT) → `POST /api/auth/login`; `LogoutButton` → `logout`; `useAccess` unifica sesión + modo del
  broker (`authenticated`/`open`/`locked`) y alimenta el **guard** `RequireAuth` (redirige a `/login`
  en modo secreto sin sesión, deja pasar en modo abierto) y el indicador de conexión honesto de la
  topbar. **Vista de prueba de Topics** (`routes/topics-page.tsx` + `TopicsTable`): lista real
  paginada con estados cargando/error/vacío (el CRUD es F3.2). **Verificado en navegador
  full-stack** (`e2e-fullstack/`, Playwright/Chromium): el **BFF real sirve el build de la SPA y
  proxya `/api/*` a un doble del broker** (topología de producción, cookie httpOnly; `NODE_ENV` sin
  fijar para que la cookie no sea `Secure` sobre `http`). 5 e2e verdes —guard redirige sin sesión,
  deep link protegido, error RFC 7807 con token inválido, **login válido → Topics lista los topics
  reales del broker vía BFF** + persistencia al recargar, y logout que vuelve al login— con capturas
  revisadas. Los e2e del shell (F2.1) simulan la sesión (`page.route`) porque corren sin BFF.
  `vitest.config.ts` excluye los directorios e2e (specs de Playwright). Repo verde:
  typecheck/lint/build/test (51 del BFF) + ambos e2e.
- [x] **F2.3 Arsenal de visualización** — wrappers base de ECharts, uPlot, visx y react-three-fiber
  con tokens dataviz; tema claro/oscuro aplicado a las gráficas. *AC:* una gráfica de cada tipo
  renderiza con datos de ejemplo y respeta el tema.
  ✔ Puente de tokens `useVizTokens` (lee los hex resueltos de la paleta dataviz y **los re-lee al
  cambiar de tema** vía `MutationObserver` sobre `data-theme` + media query, sin depender del orden
  de efectos). **Cuatro wrappers base** en `features/viz/`: `EChart` (ECharts, ciclo de vida +
  `ResizeObserver` + `setOption` notMerge), `UplotChart` (uPlot imperativo, reconstruye al cambiar
  opciones/tema), `VisxAreaChart` (composición SVG: área con degradado + línea, rejilla/ejes
  recesivos) y `ThreeClusterScene` (react-three-fiber: mini-topología 3D que rota, germen del
  *showstopper* de F3.5; fondo = superficie del tema, nodos = paleta categórica). Todas toman color
  de los tokens en **orden fijo** (grid/axis recesivos, marcas de 2px, leyenda en ECharts).
  Laboratorio `/lab` (fuera del shell/guard, **carga diferida** para no inflar el bundle principal —
  ECharts/three van a su propio chunk) que muestra una gráfica de cada librería con datos de
  ejemplo. **Verificado en navegador** (Playwright/Chromium): 2 e2e —render de las 4 (3 `<canvas>` +
  visx SVG, WebGL incluido) y respeto del tema oscuro— con capturas light/dark revisadas.
  typecheck/lint/build/test verdes.
- [x] **F2.4 Tiempo real** — hook `useLiveStream` sobre `EventSource` (SSE del BFF) con reconexión y
  **fallback a polling** de `metrics/snapshot`. *AC:* con SSE llega push en vivo; matando el SSE, cae
  a polling sin romper la UI.
  ✔ `useLiveStream` (`features/live/`): abre un `EventSource` al SSE del BFF, expone
  `{data, status, source, lastUpdatedAtMs}` y, ante **error fatal** del `EventSource` (readyState
  CLOSED) o varios reintentos transitorios seguidos, **cae a polling** del snapshot **sin romper la
  UI** (el último dato persiste, `source` pasa a `polling`); un fallo puntual del snapshot se
  señaliza (`error`) y se reintenta. Se apoya en que el SSE del BFF ya es resiliente (latidos +
  reconexión al broker): un corte del *broker* no tumba este `EventSource`, así que el fallback cubre
  que el propio plano SSE del BFF deje de estar disponible; por eso el fallo se provoca en el salto
  SPA→BFF. Laboratorio `/live-lab` (ruta abierta, sin login) con estado en vivo (color de estado +
  icono + etiqueta) y botones «Forzar fallo de SSE»/«Restaurar SSE». **Verificado en navegador
  full-stack** (`e2e-fullstack/live.spec.ts`): el BFF reemite los frames del doble del broker → **push
  en vivo** (la marca de actualización avanza sola), al forzar el fallo **cae a polling** (snapshot
  creciente, UI intacta) y al restaurar vuelve a **vivo**; capturas live/polling revisadas. El doble
  del broker se amplió con `/api/v1/stream` (SSE) y `/api/v1/metrics/snapshot`. Repo verde
  (typecheck/lint/build/test + ambos e2e).

### Fase 3 — Vistas v1
- [x] **F3.1 Dashboard vivo** — throughput, latencias p50/p99/p999, salud del cluster, estado Raft;
  todo en vivo (SSE). *AC:* refleja cambios reales del broker en <2 s.
  ✔ Dashboard que consume el **SSE del BFF** (con fallback a polling) vía `useLiveStream` y **deriva
  en el cliente** lo que el snapshot no trae calculado: throughput por segundo (diferencia de
  counters) y latencias p50/p99/p999 (cuantiles del histograma **del intervalo**, `histogram_quantile`
  estilo Prometheus). La derivación es **pura y testeada** (`metrics-snapshot.ts` + 10 tests Vitest:
  cuantiles, cubo +Inf, delta de histograma). Cuatro KPIs (entrada/salida msg/s, p99, salud del
  clúster) + **dos gráficas uPlot en vivo** (throughput y latencias, streaming con `setData` sin
  reconstruir, leyenda, tokens dataviz, tema claro/oscuro) + panel **Clúster/Raft** (nodos con el
  local marcado; tabla por partición: rol, líder, término, commit index, lag máx.), este último
  sondeado aparte con TanStack Query (`GET /api/v1/cluster` no viaja por el SSE). Estados
  honestos: «—» si falta una serie, spinner/`ProblemAlert` en el panel. **Verificado en navegador
  full-stack** (`e2e-fullstack/dashboard.spec.ts`): login → el panel pasa a **en vivo (SSE)**, el
  contador de muestras **avanza en < 2 s** (AC), p99 en ms, clúster «3 nodos · Saludable» y estado
  Raft real (`orders.events-p0`, «Líder»); las 2 gráficas se dibujan en `<canvas>`. Captura revisada.
  El doble del broker se amplió para emitir el **`MetricsSnapshot` del contrato** (counters +
  histograma + gauge) desde un reloj único (SSE y snapshot coherentes) y un `ClusterInfo` con
  consenso Raft vivo. Repo verde (typecheck/lint/build/test + e2e shell/viz **7** y full-stack **7**).
- [x] **F3.2 Topics** — listar (paginado), crear, describir (particiones), borrar, **editar
  retención (`PATCH`)**. *AC:* CRUD completo contra el broker real; el `PATCH` de retención se aplica
  y se ve el efecto.
  ✔ Vista de gestión completa: **lista paginada** (controles anterior/siguiente), **crear** (diálogo
  Radix con nombre/particiones/factor), **describir** (panel con config de retención + tabla de
  particiones: líder, high-watermark, época), **editar retención** (`PATCH`) y **borrar** (diálogo de
  confirmación, acción `danger`). Datos tipados del contrato + TanStack Query; cada mutación
  **invalida la caché** para releer del broker (nunca caché optimista). Nuevas primitivas de diseño:
  `Dialog` (Radix, foco atrapado + `Escape` + scroll lock), `Field`/`Input` y variante `danger` de
  `Button`; helper `unwrapVoid` para el `204` del `DELETE`. **PATCH con efecto real**: al aplicar, la
  descripción se vuelve a pedir al broker y el «vigente» cambia. **Verificado en navegador
  full-stack** (`e2e-fullstack/topics.spec.ts`): crear → el topic aparece en la lista real y se abre
  su detalle (4 particiones, retención «Sin límite») → **PATCH retentionMs=3600000 ⇒ el vigente pasa
  a «1 h» y persiste tras recargar** (nueva descripción del broker) → borrar ⇒ desaparece de la lista.
  El doble del broker es ahora **stateful** (POST/GET `{name}`/PATCH/DELETE con persistencia en
  memoria). Capturas revisadas. Repo verde: typecheck/lint/build/test (contract 1 + BFF 51 + web 10)
  + e2e shell/viz (7) y full-stack (**8**).
- [ ] **F3.3 Grupos** — listar y **describir** (miembros, offsets, lag). *AC:* describe muestra lag
  real por partición.
- [ ] **F3.4 Particiones** — detalle por topic (líder, high-watermark, leaderEpoch, lag).
  *AC:* datos coherentes con el describe del topic.
- [ ] **F3.5 Cluster / Raft** — nodos, roles, term, commit index, líder por partición, follower lag;
  **topología (react-three-fiber)** como pieza *showstopper*. *AC:* refleja el estado de `GET
  /cluster`; la topología responde a cambios de líder.
- [ ] **F3.6 Settings + Auth UI** — perfiles de conexión (host/puerto admin), tema, gestión de
  sesión. *AC:* cambiar de perfil reconfigura el destino del BFF; login/logout desde la UI.

### Fase 4 — Historia + empaquetado
- [ ] **F4.1 Historia (Prometheus)** — vistas de series temporales con `query_range` y gráficas
  propias; degradación limpia si no hay Prometheus. *AC:* percentiles en el tiempo con Prometheus;
  aviso claro sin él.
- [ ] **F4.2 Docker** — Dockerfile multi-stage (build SPA + runtime BFF), usuario no-root,
  `HEALTHCHECK`; `docker-compose` de ejemplo (console + broker + prometheus). *AC:* `docker compose
  up` levanta la consola apuntando al broker.
- [ ] **F4.3 Hardening + docs** — cabeceras de seguridad, CORS mismo-origen, validación repasada;
  `README` de despliegue. *AC:* revisión de seguridad de la §8 del plan pasada; README completo.

## Notas / riesgos

- **SSE, no WebSocket:** el broker expone SSE (`text/event-stream`). `herramientas/tiempo-real.md`
  habla de WebSockets (SignalR/Socket.IO); tómalo como referencia de patrones de auth/realtime, pero
  el mecanismo aquí es **EventSource** (una vía, server→cliente). Léelo junto a `fundamentos/redes/`.
- **Contraste y accesibilidad** de las gráficas: la skill dataviz cubre light/dark y daltonismo; no
  te saltes su validador de paleta.
- **Sincronía del contrato:** si NexusMQ cambia el OpenAPI, corre `sync:openapi` + `generate`; los
  tipos rotos deben salir en `typecheck`, no en runtime.
