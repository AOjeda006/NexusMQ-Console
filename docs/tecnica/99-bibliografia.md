# Apéndice B. Bibliografía

> Fuentes y especificaciones que sustentan las decisiones de la consola. Se agrupan por el
> capítulo al que dan soporte.

## Especificaciones y estándares

- **RFC 7807** — *Problem Details for HTTP APIs*. IETF, 2016. Formato de error de punta a punta
  ([capítulo 14](./14-modelo-de-errores.md)).
- **RFC 6750** — *The OAuth 2.0 Authorization Framework: Bearer Token Usage*.
- **RFC 7519** — *JSON Web Token (JWT)*.
- **RFC 6265bis** — *Cookies: HTTP State Management Mechanism* (atributos `SameSite`,
  `HttpOnly`, `Secure`).
- **OpenAPI Specification 3.0.3** — contrato del plano de operación del broker
  ([capítulo 8](./08-contrato-y-tipos-generados.md)).
- **WHATWG HTML — Server-Sent Events** y la interfaz `EventSource`
  ([capítulo 10](./10-tiempo-real-sse.md)).
- **W3C — Content Security Policy Level 3** ([capítulo 13](./13-seguridad.md)).
- **W3C — Web Content Accessibility Guidelines (WCAG) 2.2**, criterios 1.4.3 (contraste mínimo)
  y 1.4.1 (uso del color).

## Seguridad de aplicaciones web

- **OWASP** — *Top Ten* y *Application Security Verification Standard* (ASVS).
- **OWASP** — *Cheat Sheet Series*: Session Management, Cross-Site Request Forgery Prevention,
  Server-Side Request Forgery Prevention, Content Security Policy.
- Zalewski, M. *The Tangled Web: A Guide to Securing Modern Web Applications*. No Starch Press.
- **MDN Web Docs** — *HTTP headers*, *Same-origin policy*, *CORS*.

## Arquitectura y diseño

- Martin, R. C. *Clean Architecture*. Prentice Hall, 2017. Regla de dependencia e inversión
  ([capítulo 5](./05-principios-de-diseno.md)).
- Martin, R. C. *Clean Code*. Prentice Hall, 2008.
- Newman, S. *Building Microservices*. O'Reilly. Origen y encaje del patrón **BFF**.
- Fowler, M. *Patterns of Enterprise Application Architecture* y el catálogo de
  martinfowler.com (BFF, Strangler, Circuit Breaker).
- Nygard, M. *Release It!*. Pragmatic Bookshelf. Timeouts, backoff, *bulkheads*, estabilidad.
- Wiggins, A. *The Twelve-Factor App*. Configuración por entorno, paridad dev/prod
  ([capítulo 18](./18-configuracion-y-operacion.md)).
- Procida, D. **Diátaxis** — marco de documentación técnica (referencia frente a explicación).

## Sistemas distribuidos y observabilidad

- Kleppmann, M. *Designing Data-Intensive Applications*. O'Reilly, 2017. Log particionado,
  replicación, consenso — el dominio que la consola visualiza.
- Ongaro, D.; Ousterhout, J. *In Search of an Understandable Consensus Algorithm (Raft)*.
  USENIX ATC, 2014. Términos, líderes y progreso de seguidores
  ([capítulo 12](./12-visualizacion.md)).
- **Prometheus** — *Documentation*: tipos de métrica, `rate()`, `histogram_quantile()`,
  `query_range` ([capítulo 11](./11-observabilidad-y-metricas.md)).
- Tene, G. *How NOT to Measure Latency* / **HdrHistogram**. Percentiles, *coordinated
  omission*, por qué la media miente.
- Beyer, B. et al. *Site Reliability Engineering*. O'Reilly. Señales doradas, *probes* de
  liveness y readiness.

## Frontend, tiempo real y visualización

- Grigorik, I. *High Performance Browser Networking*. O'Reilly. SSE frente a WebSocket,
  buffering de proxies, conexiones persistentes.
- **Node.js Documentation** — *Stream backpressure*. Base de
  [`stream/backpressure.ts`](../../apps/bff/src/stream/backpressure.ts)
  ([capítulo 10](./10-tiempo-real-sse.md)).
- Tufte, E. *The Visual Display of Quantitative Information*. Graphics Press. Razón
  dato-tinta, elementos recesivos.
- Few, S. *Information Dashboard Design*. Analytics Press. Diseño de tableros de operación.
- Brewer, C. **ColorBrewer** y Okabe, M.; Ito, K. *Color Universal Design*. Paletas categóricas
  distinguibles con deficiencias de visión cromática ([capítulo 12](./12-visualizacion.md)).
- **Documentación de las librerías empleadas** — React, Vite, NestJS, TanStack Query, Zod,
  undici, uPlot, ECharts, visx, react-three-fiber, Radix UI, Tailwind CSS, Playwright, Vitest.

## Proyecto complementario

- **NexusMQ** — broker de mensajería distribuido en C++23 que esta consola administra:
  <https://github.com/AOjeda006/NexusMQ>. Su documentación técnica
  (`docs/tecnica/`) y su catálogo de métricas (`docs/metrics.md`) son la referencia aguas
  arriba de los capítulos [8](./08-contrato-y-tipos-generados.md) y
  [11](./11-observabilidad-y-metricas.md).
