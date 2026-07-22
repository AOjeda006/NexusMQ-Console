# Apéndice A. Registro de decisiones y evolución

> Las decisiones **as-built** que dieron forma a la consola, con su fecha y su motivo, y la
> historia de su construcción por fases. Recoge el registro que se mantuvo durante el
> desarrollo, para que el *porqué* de cada elección sobreviva al proyecto.
>
> Notación: **(esencial)** = decisión con consecuencias estructurales o de seguridad;
> **(reversible)** = elección razonada que podría cambiarse sin rediseñar.

## A.1 Decisiones de partida (2026-07-16)

| # | Decisión | Tipo |
| - | -------- | ---- |
| 1 | **Cliente externo, repositorio propio, contrato = OpenAPI de NexusMQ.** La consola no toca el core C++; solo consume el plano de operación publicado. | esencial |
| 2 | **Stack:** SPA React (Vite) + BFF NestJS, monorepo pnpm + Turborepo, TypeScript de extremo a extremo. | esencial |
| 3 | **Node 22 LTS**, gestor **pnpm**. | reversible |
| 4 | **Generación de contrato** con `openapi-typescript` (tipos) + `openapi-fetch` (cliente ligero tipado). Datos en la SPA con **TanStack Query**. | reversible |
| 5 | **OpenAPI vendorizado** en `packages/contract/openapi.yaml`, con script `sync:openapi` que lo re-descarga del *raw* del broker. **Nunca** se escriben tipos a mano. | esencial |
| 6 | **Estilo:** Tailwind CSS + primitivos Radix UI, con sistema de color y tokens guiado por la disciplina dataviz. | reversible |
| 7 | **Tests:** Vitest (web, bff, contract) + Playwright (e2e de navegador) + supertest (integración del BFF). | reversible |
| 8 | **Hosting v1:** imagen Docker genérica + `docker-compose` de ejemplo. Sin atarse a un PaaS. | reversible |
| 9 | **Transporte git = SSH.** El PAT HTTPS carecía de *scope* `workflow` y GitHub rechazaba subir `.github/workflows/`. | reversible |

## A.2 El modelo de autenticación (2026-07-16)

La decisión más consecuente del proyecto, en cuatro pasos encadenados:

**El broker no expone endpoint de login.** El `openapi.yaml` solo define `bearerAuth` (JWT
HS256), exigido si el nodo arrancó con `--jwt-secret`. **No hay ruta que acuñe tokens**: se
emiten fuera del broker. *(hecho del contrato)*

**Auth = «el operador pega su token».** *(esencial)* En el login, el operador introduce un JWT
de broker ya emitido; el BFF lo **valida contra el broker** y lo guarda **en servidor**
(almacén en memoria). Al navegador solo va una **cookie de sesión `httpOnly`** con el id. El
BFF **nunca conoce el secreto HS256**. El token del broker **no puede aparecer nunca** en una
respuesta al navegador — y hay tests que lo garantizan.

**Detección del modo por sondeo.** *(esencial)* Como el BFF no conoce el secreto, descubre si el
broker exige auth **sondeando su comportamiento**: `GET /api/v1/topics?size=1` **sin** token;
`401` ⇒ modo secreto, `2xx` ⇒ modo abierto. Se cachea.

**Cookie opaca y firmada.** *(esencial)* Sesión = id aleatorio de 256 bits guardado en servidor;
la cookie lleva `id.HMAC-SHA256(id, SESSION_SECRET)`, verificado en tiempo constante. El guard
por petición inyecta el token confinado, o responde 401.

## A.3 Tooling del BFF (2026-07-16, reversible)

NestJS 11 sobre **Express**. El paquete emite **CommonJS** (idiomático en Nest; el resto del
monorepo es ESM), con DI por constructor vía `reflect-metadata`. El **proxy usa `fetch` nativo
de undici**, no `openapi-fetch`: es *passthrough* (reemite RFC 7807 y SSE tal cual) y el
contrato se usa **solo para tipos**. Config validada con **zod** *fail-fast*. Sesiones **en
memoria**. Tests de integración con Vitest + supertest y `unplugin-swc` para la metadata de
decoradores.

## A.4 La reconciliación con el broker real (2026-07-17)

### El error

**Nombres de métrica del snapshot (decisión original, F3.1).** El `MetricsSnapshot` del
contrato es una **lista abierta** de series con `name` libre: el contrato **no fija los
nombres**. El Dashboard asumió, en un único módulo, `nexusmq_messages_in_total`,
`nexusmq_produce_latency_seconds` y `nexusmq_connections_active`, y degradaba con honestidad si
faltaban. Como no había broker real a mano, se verificó contra el **doble** — que emitía
exactamente esos nombres.

### La corrección

**Nombres REALES del broker.** *(esencial en cuanto a la fuente; reversible en cuanto al
mapeo)* La fuente de verdad de los nombres es `docs/metrics.md` del broker, **no** el OpenAPI
(que fija la *forma*). El broker no emite `nexusmq_*`: emite el plano de datos
`nexus_broker_*` con etiquetas `{api: produce|fetch, protocol: native|kafka}` —
`requests_total`, `request_errors_total`, `request_bytes_total`, `messages_total`,
`request_duration_seconds`— y `nexus_broker_connections_active{plane}`. La consola codifica
**contra estos nombres** y **filtra por etiqueta**. Sustituye la decisión anterior, que asumía
nombres ficticios: **por eso los e2e pasaban sobre un contrato equivocado — los dobles mentían**.

### Las decisiones que salieron de ahí

**Gate de login `CONSOLE_REQUIRE_LOGIN`, default `true` SIEMPRE.** *(esencial)* En todos los
entornos. Con el flag activo, el guard exige sesión válida siempre en rutas `@Protected`,
aunque el broker esté en modo abierto (deja de espejar el modo del broker). Además
`GET /api/v1/metrics/snapshot` pasa a `@Protected` — antes era alcanzable sin login **incluso
en modo secreto**: una fuga. El mecanismo de login no cambia; no se introduce una credencial de
consola nueva.

**`query_range` con allow-list de PromQL construida en SERVIDOR.** *(esencial)* El endpoint
deja de ser *passthrough* de PromQL: el cliente envía solo un **id de métrica** del catálogo
(throughput, latencias p50/p99/p999, tasa de error, bytes/s, mensajes/s) más rango y `step`
validados, y el **BFF construye la PromQL**. Fuera del allow-list → 400. El endpoint pasa a
`@Protected`. Evita que el BFF sea un motor PromQL abierto (superficie de SSRF y DoS contra
Prometheus).

## A.5 Historia de desarrollo

### Fase 0 — Andamiaje del monorepo

Monorepo pnpm + Turborepo con `apps/web`, `apps/bff`, `packages/contract`; TS base compartido,
ESLint + Prettier, `.nvmrc` (Node 22). `packages/contract` vendoriza el `openapi.yaml`, con
`sync:openapi` verificado contra descarga real y `generate` produciendo `paths`/`components`/
`operations`. CI en GitHub Actions verde. Firma SSH con la identidad del autor: commits
**Verified**.

### Fase 1 — BFF (NestJS)

Siete ítems, cada uno cerrado con pruebas:

| Ítem | Entrega |
| ---- | ------- |
| **F1.1** | Esqueleto Clean: seis módulos, DI por constructor, controllers finos, `GET /health`, arranque real verificado. |
| **F1.2** | Config *fail-fast* con zod (allow-list); un entorno inválido aborta con mensaje claro y exit 1. |
| **F1.3** | Proxy REST *passthrough* con undici: topics CRUD + `PATCH`, groups, cluster, snapshot, `healthz`/`readyz`. Validación en el borde, `ProblemDetailsFilter` global. 19 pruebas contra un doble. |
| **F1.4** | Auth con JWT confinado: login valida contra el broker, sesión en memoria, cookie `httpOnly` firmada, guard global. 7 pruebas con aserciones de **no-fuga**. |
| **F1.5** | Terminación SSE: latido, reconexión backoff + jitter sin tumbar el `EventSource`, timeouts de conexión e inactividad, cierre limpio. 3 pruebas con cliente SSE crudo. |
| **F1.6** | Data source de Prometheus con degradación limpia; 400 de consulta inválida, 502 de Prometheus caído. 7 pruebas con un doble. |
| **F1.7** | Servido de la SPA con fallback de deep links, sin tapar API ni observabilidad. 7 pruebas. |

### Fase 2 — SPA base y sistema de diseño

**F2.1** Shell + tokens dataviz validados (contraste AA verificado en navegador, claro y
oscuro). **F2.2** Capa de datos (`openapi-fetch` + TanStack Query), errores RFC 7807
normalizados, auth completa y primera vista con datos reales; verificada **full-stack** con el
BFF real sirviendo la SPA. **F2.3** Arsenal de visualización: `useVizTokens` + cuatro wrappers
(ECharts, uPlot, visx, react-three-fiber) y laboratorio `/lab`. **F2.4** Tiempo real:
`useLiveStream` con fallback a polling, verificado forzando el fallo y restaurando.

### Fase 3 — Vistas v1

**F3.1** Dashboard vivo (derivación pura y testeada de throughput y cuantiles; dos gráficas
uPlot en streaming; panel Raft). **F3.2** Topics CRUD + `PATCH` de retención **con efecto real**
(el doble del broker pasa a *stateful*). **F3.3** Grupos con lag real por partición. **F3.4**
Particiones con lag de réplica, cruzando describe con estado Raft. **F3.5** Cluster/Raft con
**topología 3D** que responde al cambio de líder. **F3.6** Ajustes (tema, sesión, conexión).

> **Desviación honesta en F3.6.** El criterio original decía «cambiar de perfil reconfigura el
> destino del BFF». **No se expuso a propósito**: el broker se fija en el despliegue (entorno
> confinado); reconfigurar el destino desde el cliente convertiría al BFF en un proxy abierto
> (SSRF) y rompería el confinamiento del token. Los perfiles multi-broker son materia de
> servidor.

### Fase 4 — Historia y empaquetado

**F4.1** Vista de Historia sobre Prometheus con modelo puro testeado y degradación limpia.
**F4.2** Dockerfile multi-stage no-root con `HEALTHCHECK`, `.dockerignore`, `docker-compose` de
ejemplo y `deploy/prometheus.yml`. **F4.3** Hardening: cabeceras de seguridad con CSP de hash
calculado del index servido, mismo origen sin CORS, validación repasada, README de despliegue.

### Fase 5 — Reconciliación con el broker real

| Ítem | Entrega |
| ---- | ------- |
| **F5.1** | `passThroughEnv` en la tarea `dev` de Turborepo: el *env-mode* estricto filtraba el entorno y el BFF abortaba. |
| **F5.2** | Dashboard e Historia remapeados a los nombres reales, con **filtrado por etiqueta** y agregación de histograma por `le`. |
| **F5.3** | Tile de **conexiones activas** con desglose por `plane` (`groupGaugeByLabel`). |
| **F5.4** | Sesiones con **TTL + purga** perezosa y periódica; `maxAge` de la cookie alineado. |
| **F5.5** | **SSE con backpressure acotado**: respeta `write()` y pausa la lectura del upstream hasta `drain`. |
| **F5.6** | `query_range` con **allow-list de PromQL en servidor** y `@Protected`. |
| **F5.7** | **Gate de login** `CONSOLE_REQUIRE_LOGIN` (default `true`) y `metrics/snapshot` protegido. |
| **F5.8** | **Re-sondeo del modo del broker con TTL** (60 s) y **todos los dobles alineados** al contrato real. |
| **F5.9** | `@see` clicable al catálogo `docs/metrics.md` del broker en los tres módulos que fijan nombres de métrica. |

### Cierre

Retirada del andamiaje de desarrollo, eliminación del *scaffolding* de capturas con ruta local
en los specs e2e, normalización de formato con `format:check` incorporado al CI, esta
documentación técnica, su PDF y la licencia.

## A.6 Riesgos anotados durante el desarrollo

Se registraron mientras se construía, y siguen vigentes:

- **La topología Raft vacía y los grupos vacíos no son bugs de la consola.** Un broker
  single-node con RF = 1 no tiene réplicas Raft, y sin consumidores no hay grupos. Ambas vistas
  deben **degradar con honestidad**, no dar error. Se poblarán solas cuando el broker avance.
- **SSE, no WebSocket.** El mecanismo es `EventSource` (una vía servidor → cliente). Las
  referencias de patrones sobre WebSockets valen para auth y resiliencia, pero no para el
  transporte.
- **Contraste y accesibilidad de las gráficas**: la validación de paleta en claro y oscuro no es
  opcional.
- **Sincronía del contrato**: si NexusMQ cambia el OpenAPI, `sync:openapi` + `generate`; los
  tipos rotos deben salir en `typecheck`, no en *runtime*. Los **nombres de métrica** son la
  excepción conocida —son cadenas— y por eso están anclados con `@see`.
