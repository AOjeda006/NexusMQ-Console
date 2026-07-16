# CLAUDE.md — NexusMQ Console

> Contexto que el agente **siempre** carga. La parte fija (memoria, commits, clarificación,
> resumabilidad) es estándar; lo específico del proyecto está en la §5 y en `@docs/PLAN.md`.
> Rutas de import: se asume `BibliotecaDocumentacion` como **carpeta hermana** (`../`).

Eres el agente que desarrolla **NexusMQ Console**. Trabaja según el contrato de `@AGENTS.md` y
mantén siempre actualizado el plan `@docs/PLAN.md`.

---

## 1. Memoria — principios y convenciones (parte fija)

Fuente de verdad de estilo y buenas prácticas. Normativas.

@../BibliotecaDocumentacion/principios/clean-architecture.md
@../BibliotecaDocumentacion/principios/solid.md
@../BibliotecaDocumentacion/principios/naming-y-estilo.md
@../BibliotecaDocumentacion/principios/manejo-errores.md
@../BibliotecaDocumentacion/principios/testing.md
@../BibliotecaDocumentacion/principios/git-workflow.md
@../BibliotecaDocumentacion/principios/desarrollo-con-ia.md
@../BibliotecaDocumentacion/stacks/typescript/convenciones.md
@../BibliotecaDocumentacion/stacks/nestjs/convenciones.md
@../BibliotecaDocumentacion/herramientas/api-rest.md
@../BibliotecaDocumentacion/herramientas/seguridad.md
@../BibliotecaDocumentacion/herramientas/autenticacion.md

> **No** importados para no inflar el contexto; **léelos cuando toques su fase**:
> tiempo real / SSE → `herramientas/tiempo-real.md` + `fundamentos/redes/convenciones.md`;
> empaquetado / CI → `herramientas/docker.md` + `herramientas/entrega-continua.md`.
> El **porqué** de cada convención vive en su `referencia.md` hermano.

---

## 2. Puerta de clarificación al arrancar (parte fija)

**Antes de tocar nada**, y al retomar tras un `/compact`:

1. Lee el objetivo, `@docs/PLAN.md` y las convenciones importadas.
2. Identifica toda decisión **esencial** sin especificar que admita varias opciones viables
   (incluye cualquier decisión abierta marcada en `PLAN.md`).
3. Si existe alguna, **pregunta todas juntas en una tanda** y **no empieces** hasta tener
   respuesta. Ante la duda entre preguntar o suponer algo esencial → **pregunta**.
4. Registra las respuestas en `docs/PLAN.md` (*Decisiones tomadas*) para que sobrevivan a `/compact`.

**Excepción:** lo trivial o reversible con un default obvio no se pregunta — decídelo, anótalo en
`PLAN.md` y sigue.

---

## 3. Política de commits (parte fija)

- **Modo git del encargo:** el usuario lo indica al arrancar (`solo-preparar` / `commit` /
  `commit+push`). Si no lo ha dicho, **pregúntalo** (decisión esencial).
- **Firma siempre.** Un commit lleva **solo las credenciales del usuario**: nada de `Co-Authored-By`,
  ni identidad de IA/modelo, ni trailers de sesión. Ningún commit *unverified*.
- **Comprueba la firma antes del primer commit:** si `git config --global commit.gpgsign` no es
  `true` (falta `SIGNING_KEY_B64` en el entorno), **no commitees** y avisa: *"La firma no está
  activa. Añade el secreto `SIGNING_KEY_B64` (Environments → variables) con
  `base64 -w0 ~/.ssh/claude_signing` y reinicia la sesión."* (detalle en el `README` del proyecto).
- **Conventional Commits** en español, atómicos, un propósito por commit
  (`feat:`/`fix:`/`docs:`/`refactor:`/`test:`/`chore:`). Cada commit deja el árbol coherente
  (checklist de `PLAN.md` al día, build/lint/tests en verde).
- **Nunca** commitees secretos. No abras PR salvo petición explícita.

---

## 4. Protocolo de resumabilidad (parte fija)

El estado vive **en disco**, no en el chat.

- **Al arrancar / retomar:** lee `docs/PLAN.md` y el último commit **antes de nada**. El PLAN es la
  única verdad de "qué falta"; no reconstruyas el estado de memoria.
- **Al completar cada paso:** marca el checklist, actualiza *Estado actual* y *Decisiones*, y
  commitea si el modo lo permite. Commits pequeños = puntos de retorno.
- **Antes de cerrar el turno:** deja `PLAN.md` coherente y el árbol en verde. Nada de `TODO` sueltos
  en el código: lo pendiente vive en `PLAN.md`.

---

## 5. Trabajo concreto de este proyecto (parte variable)

- **Qué es:** consola web de administración y monitorización del broker **NexusMQ**. Cliente
  **externo y remoto** (no toca el core C++): consume el **plano de operación REST** del broker.
- **Naturaleza:** portfolio full-stack de alto nivel; **visualización potente y llamativa** es
  prioridad nº1 (aplica la skill **dataviz** para color/diseño). El broker y su contrato ya están
  cerrados; aquí se construye solo el cliente.
- **Stack:** TypeScript end-to-end. **SPA** React (Vite) + **BFF** NestJS. Monorepo pnpm +
  Turborepo: `apps/web`, `apps/bff`, `packages/contract` (tipos+cliente generados del OpenAPI de
  NexusMQ). Viz: ECharts, uPlot, visx, react-three-fiber.
- **Contrato (fuente de verdad):** `docs/openapi.yaml` de **NexusMQ**. La consola **genera** su
  cliente tipado; **nunca** escribe tipos del contrato a mano. Endpoints v1: `metrics/snapshot`,
  topics CRUD + `PATCH`, `groups` list + `{id}`, `cluster`, `stream` (SSE), `healthz`/`readyz`.
- **BFF (por qué existe):** el navegador **nunca** habla directo con el broker ni con Prometheus. El
  BFF proxya, gestiona **JWT confinado en servidor**, **termina el SSE**, sirve la SPA y evita CORS.
- **Restricciones / no-objetivos:** no reimplementar TSDB (eso es Prometheus); no embeber Grafana;
  no endpoint "kill"; sin app móvil (web responsiva). El detalle y el checklist, en `@docs/PLAN.md`.
- **Cómo ejecutar y probar:** ver `@AGENTS.md` (*Comandos del proyecto*).
