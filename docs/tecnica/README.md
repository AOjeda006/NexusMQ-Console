# Documentación técnica de NexusMQ Console

> Documentación técnica **final** de NexusMQ Console: la consola web de administración y
> monitorización del broker [NexusMQ](https://github.com/AOjeda006/NexusMQ) —SPA React + BFF
> NestJS, TypeScript de extremo a extremo—. Es la **fuente de verdad** del proyecto: describe
> el sistema **as-built**, apoyándose en el contrato vendorizado
> [`packages/contract/openapi.yaml`](../../packages/contract/openapi.yaml) y en el código de
> [`apps/`](../../apps/) y [`packages/`](../../packages/).

> Disponible también como **[PDF único](../pdf/NexusMQ-Console-documentacion-tecnica.pdf)**
> (documentación técnica completa con los diagramas Mermaid renderizados). Se regenera con
> [`docs/pdf/`](../pdf/).

Lectura recomendada en orden; cada capítulo es autocontenido y enlaza con los demás.

- [Prefacio](./00-prefacio.md)

## Parte I — Introducción y visión
- [1. Resumen ejecutivo](./01-resumen-ejecutivo.md)
- [2. Contexto y motivación](./02-contexto-y-motivacion.md)
- [3. Glosario](./03-glosario.md)

## Parte II — Arquitectura
- [4. Vista de conjunto](./04-vista-de-conjunto.md)
- [5. Principios de diseño](./05-principios-de-diseno.md)
- [6. Arquitectura del frontend](./06-arquitectura-frontend.md)
- [7. Arquitectura del BFF](./07-arquitectura-bff.md)

## Parte III — Contrato e integración
- [8. Contrato y tipos generados](./08-contrato-y-tipos-generados.md)
- [9. Autenticación y sesiones](./09-autenticacion-y-sesiones.md)
- [10. Tiempo real: terminación de SSE](./10-tiempo-real-sse.md)
- [11. Observabilidad y métricas](./11-observabilidad-y-metricas.md)

## Parte IV — Experiencia y seguridad
- [12. Visualización](./12-visualizacion.md)
- [13. Seguridad](./13-seguridad.md)
- [14. Modelo de errores](./14-modelo-de-errores.md)

## Parte V — Calidad
- [15. Estrategia de pruebas](./15-estrategia-de-pruebas.md)
- [16. Puerta de calidad y CI/CD](./16-puerta-de-calidad-y-cicd.md)

## Parte VI — Operación y despliegue
- [17. Despliegue](./17-despliegue.md)
- [18. Configuración y operación](./18-configuracion-y-operacion.md)

## Parte VII — Evolución
- [19. Limitaciones y trabajo futuro](./19-limitaciones-y-trabajo-futuro.md)

## Apéndices
- [A. Registro de decisiones y evolución](./98-registro-de-decisiones.md)
- [B. Bibliografía](./99-bibliografia.md)
- Contrato as-built: [`openapi.yaml`](../../packages/contract/openapi.yaml) ·
  Configuración: [`.env.example`](../../.env.example) ·
  Broker: [NexusMQ](https://github.com/AOjeda006/NexusMQ)

---

### Atajos por interés

| Si te interesa… | Empieza por |
| --------------- | ----------- |
| Qué es y qué resuelve | [1. Resumen ejecutivo](./01-resumen-ejecutivo.md) |
| Por qué existe un BFF | [2. Contexto](./02-contexto-y-motivacion.md) · [7. BFF](./07-arquitectura-bff.md) |
| La postura de seguridad | [9. Autenticación](./09-autenticacion-y-sesiones.md) · [13. Seguridad](./13-seguridad.md) |
| Cómo se hace el tiempo real | [10. SSE](./10-tiempo-real-sse.md) |
| De dónde salen los números | [11. Observabilidad y métricas](./11-observabilidad-y-metricas.md) |
| El diseño visual | [12. Visualización](./12-visualizacion.md) |
| Cómo se verifica | [15. Pruebas](./15-estrategia-de-pruebas.md) · [16. CI/CD](./16-puerta-de-calidad-y-cicd.md) |
| Cómo se despliega y opera | [17. Despliegue](./17-despliegue.md) · [18. Operación](./18-configuracion-y-operacion.md) |
| Qué **no** hace y por qué | [19. Limitaciones](./19-limitaciones-y-trabajo-futuro.md) |
