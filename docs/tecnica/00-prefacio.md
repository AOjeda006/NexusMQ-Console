# Prefacio

> Este documento es la **documentación técnica final** de NexusMQ Console: la referencia
> autoritativa del *qué*, el *porqué* y el *cómo* de la consola, organizada para leerse de
> principio a fin o consultarse por partes.

## Qué es este documento

**NexusMQ Console** es la consola web de administración y monitorización del broker de
mensajería distribuido [NexusMQ](https://github.com/AOjeda006/NexusMQ). Es un **cliente
externo y remoto**: no toca el core C++ del broker, sino que consume su **plano de
operación REST** (contrato OpenAPI) desde una arquitectura TypeScript de dos piezas —una
**SPA** React y un **BFF** NestJS— empaquetadas en una sola imagen.

Como el broker que administra, es un **proyecto de aprendizaje y portfolio**. Su tesis no
es acumular pantallas, sino demostrar que un cliente de operación serio se construye con
las mismas exigencias que un backend: contrato como fuente de verdad, frontera de confianza
explícita, degradación honesta, y una visualización que comunique el estado real del sistema
en lugar de decorarlo.

Esta documentación recoge la consola **tal como está construida** (*as-built*): la visión y
el contexto, la arquitectura de sus tres paquetes, el contrato y su generación de tipos, la
autenticación confinada en servidor, el tiempo real, la observabilidad, la visualización, la
seguridad, la estrategia de pruebas, la operación y el registro de decisiones que la llevó
hasta aquí.

## A quién va dirigido

- **Al autor**, como mapa de construcción y memoria del diseño.
- **A revisores técnicos** (entrevistadores, colaboradores) que evalúen el proyecto como
  muestra de competencia *full-stack*: TypeScript de extremo a extremo, arquitectura
  cliente-servidor con una frontera de confianza real, integración con un sistema
  distribuido ajeno a través de su contrato, y diseño de información para operar
  infraestructura.

Se asume familiaridad con desarrollo web moderno (React, HTTP, TypeScript) y con conceptos
de operación (métricas, series temporales, autenticación por token). Los términos de dominio
—los del broker y los de la consola— se definen en el [Glosario](./03-glosario.md).

## Cómo está organizado

La documentación se divide en **siete partes** más **apéndices**:

| Parte | Contenido |
| ----- | --------- |
| **I — Introducción y visión** | Resumen ejecutivo, contexto y motivación, glosario. |
| **II — Arquitectura** | Vista de conjunto, principios de diseño, arquitectura del frontend y del BFF. |
| **III — Contrato e integración** | Contrato y tipos generados, autenticación y sesiones, tiempo real (SSE), observabilidad y métricas. |
| **IV — Experiencia y seguridad** | Visualización, seguridad, modelo de errores. |
| **V — Calidad** | Estrategia de pruebas, puerta de calidad y CI/CD. |
| **VI — Operación y despliegue** | Despliegue, configuración y operación. |
| **VII — Evolución** | Limitaciones y trabajo futuro. |

Los **apéndices** recogen el registro de decisiones as-built y la bibliografía.

Cada capítulo vive en su propio fichero Markdown numerado bajo `docs/tecnica/`. Los
**diagramas** son bloques **Mermaid embebidos** en el capítulo que los explica: no hay
catálogo aparte, porque un diagrama de esta consola casi nunca se entiende sin la prosa que
lo rodea.

## Relación con el contrato del broker

La consola tiene **una sola fuente de verdad externa**: el `openapi.yaml` de NexusMQ. De él
se **generan** los tipos y el cliente HTTP de `packages/contract`; nada del contrato se
escribe a mano. Este documento **explica y enlaza** ese contrato —da *rationale*, flujos y
diagramas— pero **no lo duplica**: para el detalle preciso de un *endpoint* o de un esquema,
la referencia es el propio OpenAPI vendorizado en
[`packages/contract/openapi.yaml`](../../packages/contract/openapi.yaml) y, aguas arriba, la
[documentación técnica de NexusMQ](https://github.com/AOjeda006/NexusMQ/tree/main/docs/tecnica).

Hay una segunda dependencia de contrato que **no** viaja por el OpenAPI: los **nombres de
las métricas**. El OpenAPI fija la *forma* del snapshot (una lista abierta de muestras), no
sus nombres; esos viven en el catálogo `docs/metrics.md` del broker. El
[capítulo 11](./11-observabilidad-y-metricas.md) explica cómo se ancla la consola a ese
catálogo y qué pasa cuando el broker aún no emite una familia.

## Alcance y fuentes

Esta documentación es la **fuente de verdad** del proyecto. El código en
[`apps/`](../../apps/) y [`packages/`](../../packages/) y la suite de pruebas son la
referencia última cuando el detalle de implementación importa: todo lo que aquí se afirma
está sostenido por código que compila y por tests que pasan. Cuando algo **no** funciona o
está limitado, se dice —ver el [capítulo 19](./19-limitaciones-y-trabajo-futuro.md).
