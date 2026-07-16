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
limpio. Typecheck/lint/build/test verdes (37 tests). **Siguiente: Fase 1 — BFF, ítem F1.6**
(Prometheus data source `query_range` con degradación limpia sin `PROMETHEUS_URL`).

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
- [ ] **F1.6 Prometheus data source** — proxy de `query_range` con **degradación limpia**: si no hay
  `PROMETHEUS_URL`, responde "no disponible" sin romper. *AC:* con y sin Prometheus, el BFF responde
  coherente (datos / vacío señalizado).
- [ ] **F1.7 Sirve la SPA** — en prod, el BFF sirve el build estático de `apps/web` (mismo origen).
  *AC:* build de producción del BFF sirve la SPA en `/`.

### Fase 2 — SPA base + sistema de diseño
- [ ] **F2.1 Shell + diseño (dataviz)** — Vite React TS; layout, routing, tema claro/oscuro;
  **aplica la skill dataviz** para paleta/tokens/tipografía. Tailwind + Radix.
  *AC:* shell navegable, accesible (contraste AA) en claro y oscuro; tokens centralizados.
- [ ] **F2.2 Capa de datos + auth** — cliente `openapi-fetch` del contrato + TanStack Query; manejo
  de errores RFC 7807 → UI; flujo de login/logout contra el BFF; guard de rutas.
  *AC:* login funciona; una vista de prueba lista topics reales del broker vía BFF.
- [ ] **F2.3 Arsenal de visualización** — wrappers base de ECharts, uPlot, visx y react-three-fiber
  con tokens dataviz; tema claro/oscuro aplicado a las gráficas. *AC:* una gráfica de cada tipo
  renderiza con datos de ejemplo y respeta el tema.
- [ ] **F2.4 Tiempo real** — hook `useLiveStream` sobre `EventSource` (SSE del BFF) con reconexión y
  **fallback a polling** de `metrics/snapshot`. *AC:* con SSE llega push en vivo; matando el SSE, cae
  a polling sin romper la UI.

### Fase 3 — Vistas v1
- [ ] **F3.1 Dashboard vivo** — throughput, latencias p50/p99/p999, salud del cluster, estado Raft;
  todo en vivo (SSE). *AC:* refleja cambios reales del broker en <2 s.
- [ ] **F3.2 Topics** — listar (paginado), crear, describir (particiones), borrar, **editar
  retención (`PATCH`)**. *AC:* CRUD completo contra el broker real; el `PATCH` de retención se aplica
  y se ve el efecto.
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
