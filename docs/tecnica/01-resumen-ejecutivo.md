# 1. Resumen ejecutivo

> Qué es NexusMQ Console, qué resuelve, cómo está construida y qué la distingue de una
> pantalla de administración cualquiera. Los capítulos siguientes desarrollan cada punto.

## 1.1 Qué es

NexusMQ Console es la **consola web de operación** del broker NexusMQ: una aplicación que
permite ver el estado del clúster en vivo, administrar *topics*, inspeccionar grupos de
consumo y particiones, seguir el consenso Raft y consultar la historia de métricas, todo
contra un broker real y remoto.

Es **TypeScript de extremo a extremo** en un monorepo pnpm + Turborepo con tres paquetes:

| Paquete | Qué es | Responsabilidad |
| ------- | ------ | --------------- |
| `apps/web` | SPA React 19 sobre Vite | Interfaz, visualización, estado de cliente. |
| `apps/bff` | BFF NestJS 11 sobre Express | Frontera de confianza: proxy, sesiones, SSE, servido de la SPA. |
| `packages/contract` | Tipos + cliente **generados** | Única traducción del OpenAPI de NexusMQ a TypeScript. |

## 1.2 El problema que resuelve

Un broker distribuido expone un plano de operación REST y un endpoint de métricas. Eso basta
para `curl`, pero no para **operar**: entender si el clúster está sano exige correlacionar
throughput, latencias por percentil, errores, conexiones y estado de consenso, y hacerlo
mientras cambian. La consola convierte ese plano en una superficie de operación:

- **Dashboard vivo** — throughput *produce*/*fetch*, latencias p50/p99/p999 derivadas del
  histograma del intervalo, tasa de error, conexiones por plano y salud del clúster, todo
  empujado por **SSE** con fallback a *polling*.
- **Topics** — listado paginado, creación, descripción (configuración + particiones),
  edición de retención vía `PATCH` y borrado.
- **Grupos** — listado con estado y descripción con miembros, *offsets* confirmados y **lag
  real por partición**.
- **Particiones** — líder, *high-watermark*, época y **lag de réplica**, cruzando la
  descripción del topic con el estado Raft del clúster.
- **Cluster / Raft** — nodos, roles, término, *commit index* y una **topología 3D** que
  responde a los cambios de líder.
- **Historia** — series temporales desde Prometheus con ventanas de 15 min a 24 h.

## 1.3 Por qué existe el BFF

El navegador **nunca** habla directamente con el broker. Entre ambos hay un BFF NestJS que
existe por cuatro razones concretas, no por moda arquitectónica:

1. **Confinar el JWT.** El token del broker se guarda en servidor; al navegador solo viaja
   una cookie de sesión `httpOnly` firmada. Hay tests que verifican que el token no aparece
   nunca en una respuesta ([capítulo 9](./09-autenticacion-y-sesiones.md)).
2. **Terminar el SSE.** El BFF mantiene su propia conexión al *stream* del broker y
   reconecta con *backoff* + *jitter* sin tumbar el `EventSource` del navegador
   ([capítulo 10](./10-tiempo-real-sse.md)).
3. **Cerrar la superficie de consulta.** El endpoint de historia no acepta PromQL cruda: el
   cliente elige un **id de una allow-list** y el BFF construye la consulta
   ([capítulo 11](./11-observabilidad-y-metricas.md)).
4. **Servir la SPA en el mismo origen.** Sin CORS, con CSP anclada a `'self'`
   ([capítulo 13](./13-seguridad.md)).

## 1.4 Qué la distingue

- **El contrato no se escribe a mano.** `openapi-typescript` genera los tipos desde el
  `openapi.yaml` vendorizado del broker; un cambio de contrato rompe el `typecheck`, no el
  *runtime* ([capítulo 8](./08-contrato-y-tipos-generados.md)).
- **Degradación honesta.** Si el broker no emite una familia de métricas, la consola muestra
  «—» y lo dice; no inventa ceros. Si no hay Prometheus, la vista de Historia avisa y el
  resto sigue funcionando.
- **Un solo modelo de error.** RFC 7807 de punta a punta: el broker lo emite, el BFF lo
  propaga *verbatim* o genera el suyo, y la SPA lo muestra con icono y texto
  ([capítulo 14](./14-modelo-de-errores.md)).
- **Visualización con criterio.** Cuatro librerías elegidas por lo que cada una hace mejor
  (uPlot para *streaming*, ECharts para exploración, visx para composición, react-three-fiber
  para la topología), todas alimentadas por **un único sistema de tokens** validado en claro y
  oscuro ([capítulo 12](./12-visualizacion.md)).
- **Verificación en navegador de verdad.** 21 pruebas Playwright, de las cuales 14 corren
  contra la topología de producción real —el BFF sirviendo la SPA y proxyando a un doble del
  broker— y no contra mocks de red ([capítulo 15](./15-estrategia-de-pruebas.md)).

## 1.5 Estado

**Versión 1 completa y cerrada.** Cinco fases entregadas: andamiaje del monorepo, BFF,
SPA base y sistema de diseño, vistas v1, historia y empaquetado, y una fase final de
reconciliación con el broker real que corrigió el catálogo de métricas y endureció el
servidor.

| Indicador | Valor |
| --------- | ----- |
| Pruebas unitarias y de integración | **105** (BFF 82 · web 22 · contract 1) |
| Pruebas e2e en navegador | **21** (SPA 7 · full-stack 14) |
| Puerta de calidad | install · generate · lint · format · typecheck · build · test |
| Empaquetado | Imagen Docker multi-stage, no-root, con `HEALTHCHECK` |

El detalle de lo que **no** hace y por qué está en el
[capítulo 19](./19-limitaciones-y-trabajo-futuro.md).
