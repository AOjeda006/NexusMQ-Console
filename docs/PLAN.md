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

## Decisiones abiertas (resolver en la puerta de clarificación con el usuario)

- _(ninguna pendiente — todas las abiertas se resolvieron el 2026-07-16; ver arriba)_

## Estado actual

Fase 0 en curso. Decisiones de arranque cerradas (main directo + push + Docker). `pnpm 11.13.1`
instalado. **F0.1 hecho** (monorepo verde: install/build/lint/typecheck/test).
**Siguiente: F0.2 — `packages/contract`.**

---

## Checklist

> `[ ]` pendiente · `[x]` hecho (cumple criterio + verificado + commiteado si procede).

### Fase 0 — Andamiaje del monorepo
- [x] **F0.1 Monorepo base** — pnpm workspaces + Turborepo con `apps/web`, `apps/bff`,
  `packages/contract`; TS base compartido, ESLint + Prettier, `.gitignore`, `.nvmrc` (Node 22).
  *AC:* `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm typecheck` verdes en un árbol vacío.
  ✔ install/build/lint/typecheck/test verdes; aprobación de build scripts (esbuild) vía
  `pnpm-workspace.yaml` (`allowBuilds`).
- [ ] **F0.2 `packages/contract`** — vendoriza `openapi.yaml` de NexusMQ; script `sync:openapi`;
  `generate` con `openapi-typescript`; exporta `openapi-fetch` tipado + tipos.
  *AC:* `pnpm --filter @nexusmq/contract generate` produce tipos; se importa desde web y bff sin error.
- [ ] **F0.3 CI (GitHub Actions)** — workflow que en cada push corre install + lint + typecheck +
  build + test. *AC:* workflow en verde en GitHub.
- [ ] **F0.4 Firma e identidad** — `.claude/settings.json` colocado; verificar commits **Verified**
  con la identidad del usuario. *AC:* `git log --show-signature` marca el commit como firmado.

### Fase 1 — BFF (NestJS)
- [ ] **F1.1 Esqueleto Clean** — módulos `config`, `health`, `broker` (proxy), `prometheus`, `auth`,
  `stream` (SSE); DI por constructor; sin lógica de negocio en controllers.
  *AC:* `pnpm --filter @nexusmq/bff dev` arranca; `GET /health` responde; tests de arranque en verde.
- [ ] **F1.2 Config validada** — env: `BROKER_ADMIN_URL`, `PROMETHEUS_URL` (opcional), secreto de
  sesión, TLS/`NODE_EXTRA_CA_CERTS`. Validación *fail-fast* al arranque (allow-list).
  *AC:* arranca solo con config válida; un env inválido aborta con mensaje claro.
- [ ] **F1.3 Proxy REST del broker** — reexponer topics CRUD+`PATCH`, groups list+`{id}`, `cluster`,
  `metrics/snapshot`, `healthz/readyz`. Validación en el borde; passthrough de RFC 7807.
  *AC:* e2e (supertest) contra un **doble del broker** cubre cada endpoint (éxito + error 4xx).
- [ ] **F1.4 Auth/JWT confinado** — login → el BFF obtiene y **guarda el JWT del broker en
  servidor**; al navegador, cookie de sesión **httpOnly**. Guard por petición; logout.
  *AC:* el token del broker **no** aparece nunca en respuestas al navegador; rutas protegidas dan 401
  sin sesión.
- [ ] **F1.5 Terminación SSE** — conectar a `GET /api/v1/stream` del broker y **reemitir** SSE al
  navegador (mismo origen); reconexión, timeout y cierre limpio; backpressure acotado.
  *AC:* un cliente `EventSource` contra el BFF recibe frames; al caer el broker, el BFF reconecta sin
  tumbar la conexión del navegador.
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
