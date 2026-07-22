# 19. Limitaciones y trabajo futuro

> Qué **no** hace la consola, por qué, y qué haría falta para que lo hiciera. Un proyecto que
> no dice dónde están sus bordes no es honesto sobre su calidad.

## 19.1 Limitaciones conocidas

### Sesiones en memoria: una sola instancia

El almacén de sesiones es un `Map` en el proceso del BFF. Con varias réplicas, un operador solo
funciona contra la instancia que le dio la sesión, salvo sesiones pegajosas en el balanceador.

*Qué haría falta:* un almacén compartido (Redis) o sesiones sin estado. La segunda opción es
más delicada de lo que parece: haría falta cifrar el token del broker dentro de la cookie, lo
que reintroduce en el navegador justo lo que este diseño saca de ahí. La primera es la correcta.

### Escalado y disponibilidad

Derivado de lo anterior: la consola está pensada como **una instancia** por despliegue. No es
una limitación grave —una consola de operación no es el camino caliente— pero conviene decirlo.

### Sin auditoría de acciones

Quién creó, alteró o borró un topic, y cuándo, no queda registrado. Los logs del BFF registran
que hubo una sesión, no qué hizo.

*Qué haría falta:* un log de auditoría estructurado con identidad del operador. Como la
identidad viene en el JWT del broker, habría que decodificar sus *claims* — el BFF hoy no lo
hace porque no necesita hacerlo, y decodificar sin verificar (no conoce el secreto) tendría que
tratarse como dato no confiable.

### Sin rate limiting en el login

Validar un token contra el broker es una petición barata, y el broker tiene su propia
protección, pero un limitador en el BFF sería defensa en profundidad razonable.

### Multi-broker no expuesto en la interfaz

La página de Ajustes muestra el destino del broker como «Confinado en el servidor (BFF)» y no
permite cambiarlo. Es una **desviación consciente** de la idea original de "perfiles de
conexión": permitir que el navegador reconfigure el destino convertiría al BFF en un **proxy
abierto** (SSRF) y rompería el confinamiento del token.

*Qué haría falta:* perfiles definidos **en servidor** —una lista cerrada de despliegues
conocidos, por entorno— entre los que la interfaz pudiera elegir por id. Es trabajo de
servidor, no de cliente.

### Los e2e no corren en el CI

El workflow llega hasta `pnpm test`. Las 21 pruebas Playwright se ejecutan en local antes de
cada *push*. Un contribuidor externo que no las ejecutara no vería el fallo en el CI.

*Qué haría falta:* un job con `playwright install --with-deps chromium`, ejecutado en `main` o
bajo etiqueta para no penalizar cada *push*.

### `docker compose up` no ejecutado

El entorno de desarrollo no tenía Docker. El runtime de la imagen se verificó **sin el
demonio** (bundle de producción correcto, servido de la SPA, deep links, `/health`, comando del
`HEALTHCHECK` con exit 0/1, YAML válido), pero falta el ciclo completo en una máquina con
Docker. Detalle en el [capítulo 17](./17-despliegue.md), §17.7.

### Nombres de métrica: acoplamiento fuera del contrato

El `MetricsSnapshot` es una lista abierta; el OpenAPI no fija los nombres. Si el broker renombra
una familia, **el `typecheck` no lo detecta** —son cadenas— y la consola degradará a «—» sin
avisar por qué.

*Mitigación actual:* los tres módulos que fijan nombres llevan un `@see` clicable al catálogo
del broker. *Qué haría falta de verdad:* que el broker publicara su catálogo de métricas como
artefacto versionado y consumible (un JSON junto al OpenAPI), del que se pudieran generar
constantes igual que se generan los tipos.

## 19.2 Dependencias del broker

Hay comportamientos que parecen carencias de la consola y son estado real del broker. La consola
los degrada con honestidad; se poblarán solos cuando el broker avance:

| Se ve así | Causa | Cuándo cambiará |
| --------- | ----- | --------------- |
| Topología Raft sin aristas | Single-node con `replication_factor = 1`: no hay réplicas que mostrar. | Con un clúster de ≥ 2 nodos y RF ≥ 2. |
| Grupos vacíos | No hay consumidores conectados. | Con consumidores reales. |
| `msg/s` o conexiones en «—» | El broker aún no emitía esas familias cuando se escribió el mapeo. | En cuanto las emita: los tiles se encienden solos, sin tocar la consola. |

Esto último es una propiedad del diseño, no una casualidad: la consola **ya** consulta los
nombres correctos y degrada solo por ausencia. Cuando el dato aparece, se muestra.

### Control de ciclo de vida de nodos

Arrancar, parar o drenar un nodo desde la consola requiere una capa de servicio del SO que el
broker no expone. No hay endpoint que invocar. Queda fuera de v1 por dependencia externa, no
por decisión de alcance.

## 19.3 Trabajo futuro, por valor

**Alto valor, coste contenido:**

1. **Job de e2e en el CI** — cierra el único hueco real de la puerta de calidad.
2. **Auditoría de acciones** — necesaria en cuanto haya más de un operador.
3. **Rate limiting en el login** — defensa en profundidad barata.
4. **Alertas visuales sobre umbrales** — que la consola marque un p99 fuera de rango, en lugar
   de dejar que el operador lo detecte mirando. Aprovecharía los tokens de estado que ya
   existen.

**Alto valor, coste mayor:**

5. **Perfiles multi-broker definidos en servidor** — con la restricción de seguridad resuelta
   por diseño (lista cerrada por entorno).
6. **Sesiones en almacén compartido** — habilita el escalado horizontal.
7. **Catálogo de métricas versionado** en el broker, generable como constantes. Elimina el
   único acoplamiento del proyecto que no está cubierto por el compilador.

**Exploratorio:**

8. **Vista de consumo por topic en el tiempo** cruzando lag de grupo con throughput.
9. **Exportación de una ventana de métricas** (CSV/PNG) para incidencias.
10. **Modo quiosco** para pantallas de operación: rotación de vistas, sin interacción.

## 19.4 Lo que no se hará

Y por qué, para que no vuelva a discutirse:

| No se hará | Razón |
| ---------- | ----- |
| Almacenar series en la consola | Es el trabajo de Prometheus. Duplicarlo añade un sistema de estado que mantener y sincronizar. |
| Embeber Grafana | Un `<iframe>` no es un producto, y la visualización propia es la tesis del proyecto. |
| Endpoint "kill" del broker | Operación destructiva sin confirmación fuera de banda ni auditoría. No pertenece a una consola web. |
| App móvil nativa | La web responsiva cubre el caso; una app nativa duplica el trabajo sin añadir tesis técnica. |
| Escribir tipos del contrato a mano | Rompe la propiedad que sostiene todo el proyecto: que un cambio del broker falle al compilar. |
| Reconfigurar el broker desde el navegador | Convierte el BFF en un proxy abierto. Ver §19.1. |
