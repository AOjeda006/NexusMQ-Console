# 3. Glosario

> Términos que aparecen a lo largo del documento, divididos entre los que vienen del **broker**
> (dominio de mensajería) y los que son propios de la **consola** (dominio de cliente web).
> Los identificadores de código van en inglés; la prosa, en español.

## 3.1 Del dominio del broker

**Broker** — Nodo de NexusMQ (`nexusd`). Sirve el plano de datos (produce/fetch), el plano de
consenso (Raft) y el plano de control (REST `/api/v1`, `/healthz`, `/readyz`, `/metrics`).

**Plano de operación / plano de control (*admin plane*)** — La API REST de administración del
broker, más salud y métricas. Es lo único que consume la consola. Escucha en el puerto que
fija `--admin-port`.

**Topic** — Canal lógico de mensajes, dividido en particiones. La consola lo lista, crea,
describe, altera (retención) y borra.

**Partición** — Unidad de paralelismo y de replicación de un topic. Cada partición es su
propio grupo Raft en NexusMQ.

**High-watermark (HWM)** — Offset hasta el cual los registros de una partición están
confirmados por el quórum y son visibles para los consumidores.

**Leader epoch (época del líder)** — Contador que identifica el mandato de un líder sobre una
partición; permite detectar y truncar divergencias de log.

**Raft** — Algoritmo de consenso que NexusMQ ejecuta **por partición**. De él la consola
muestra rol, líder, término (*term*), *commit index* y progreso de seguidores.

**Follower lag (lag de réplica)** — Cuánto va por detrás un seguidor respecto del líder de su
partición. La consola lo obtiene del estado Raft (`GET /api/v1/cluster`), no del describe del
topic.

**Grupo de consumo** — Conjunto de consumidores que se reparten las particiones de uno o
varios topics. Tiene estado, generación, líder y miembros.

**Consumer lag** — Diferencia entre el *high-watermark* de una partición y el offset
confirmado por el grupo: cuántos mensajes le faltan por consumir.

**RFC 7807 (`application/problem+json`)** — Formato estándar de documento de error que emiten
tanto el broker como el BFF. Ver [capítulo 14](./14-modelo-de-errores.md).

## 3.2 De la consola

**SPA (*Single Page Application*)** — `apps/web`: la aplicación React que se ejecuta en el
navegador. Servida por Vite en desarrollo y por el BFF en producción.

**BFF (*Backend For Frontend*)** — `apps/bff`: el servidor NestJS que existe **solo** para
esta interfaz. Proxya el broker, confina el token, termina el SSE, expone el data source de
historia y sirve la SPA. Es la frontera de confianza.

**Contrato** — `packages/contract`: los tipos TypeScript y el cliente HTTP **generados** con
`openapi-typescript` desde el `openapi.yaml` vendorizado del broker. Nunca se escribe a mano.

**Vendorizado** — Copia versionada del `openapi.yaml` del broker dentro de este repositorio,
refrescable con `pnpm --filter @nexusmq/contract sync:openapi`. Hace el build reproducible y
desacopla de la disponibilidad de la red.

**Modo abierto / modo secreto** — Los dos modos en que puede estar el broker. En **modo
secreto** arrancó con `--jwt-secret` y exige `Authorization: Bearer`; en **modo abierto**, no.
El BFF descubre cuál es **sondeando el comportamiento** del broker, porque no conoce su
secreto HS256. Ver [capítulo 9](./09-autenticacion-y-sesiones.md).

**Sesión de operador** — Entrada del almacén en memoria del BFF que guarda el JWT del broker
que el operador pegó al iniciar sesión. Tiene TTL y se purga.

**Cookie de sesión** — `nexusmq_session`, `httpOnly`, `SameSite=Lax`, `Secure` en producción.
Transporta `id.HMAC-SHA256(id, SESSION_SECRET)`: una clave opaca, nunca datos.

**Gate de login (`CONSOLE_REQUIRE_LOGIN`)** — Bandera del BFF que, activa (por defecto), exige
sesión válida en las rutas protegidas **aunque el broker esté en modo abierto**.

**`@Protected()`** — Decorador que marca una ruta del BFF como sujeta al `SessionAuthGuard`.
Las rutas sin él (salud, `stream`, endpoints de auth) pasan sin sesión.

**Terminación de SSE** — El BFF abre su propia conexión `text/event-stream` al broker y
reemite los frames al navegador. El navegador nunca abre un `EventSource` contra el broker.

**Backpressure acotado** — Política del bombeo SSE: si el socket del cliente no acepta más
datos, se **pausa la lectura del broker** hasta el evento `drain`, en lugar de acumular en
memoria sin límite.

**Degradación honesta** — Regla de diseño transversal: cuando un dato no está disponible, la
interfaz muestra «—» y explica por qué, en lugar de mostrar un cero que se lee como "todo
tranquilo".

**Allow-list de PromQL** — Lista cerrada de ids de métrica de historia. El cliente envía un
id; el BFF **construye** la PromQL en servidor. El endpoint no acepta consultas crudas.

**Tokens dataviz** — Variables CSS de `apps/web/src/styles/tokens.css` que definen
superficies, tinta, estado y la paleta categórica de 8. Fuente única de color de la consola.

**Doble (*test double*)** — Servidor de prueba que implementa el contrato del broker o de
Prometheus para los tests. Desde la fase 5, todos emiten los **nombres reales** del broker.

**e2e full-stack** — Suite Playwright que arranca la topología de producción real (BFF
sirviendo la SPA + doble del broker + doble de Prometheus) y la ejerce desde el navegador.
