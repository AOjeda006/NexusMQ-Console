# AGENTS.md — Contrato de trabajo del agente (NexusMQ Console)

> Define **cómo** trabaja el agente turno a turno y cómo retoma tras un `/compact`. Lo referencia
> `CLAUDE.md`. Ante conflicto, mandan las convenciones importadas en `CLAUDE.md`.

Este documento es el **contrato operativo**. `CLAUDE.md` dice *qué* convenciones seguir; este dice
*cómo* proceder.

## Ciclo de trabajo (cada turno)

1. **Orientarse:** lee `docs/PLAN.md` y el último commit. Localiza el primer ítem no completado del
   checklist. El PLAN es la verdad; no reconstruyas el estado de memoria.
2. **Clarificar (puerta de arranque):** si hay decisiones esenciales sin especificar con varias
   opciones viables, pregúntalas **todas juntas** y **no avances** hasta resolverlas. Anota en
   `PLAN.md` → *Decisiones tomadas*.
3. **Ejecutar un paso:** aborda **un** ítem del checklist a la vez. Respeta las convenciones
   (Clean Architecture, naming, errores, testing, seguridad).
4. **Verificar:** ejecuta build/tests/lint. Un paso no está "hecho" hasta cumplir su **criterio de
   aceptación** en `PLAN.md`. En cambios con superficie de runtime, **arráncalo y compruébalo de
   verdad** (no solo que compila): la vista pinta, el endpoint responde, el SSE emite.
5. **Registrar:** marca el ítem, actualiza *Estado actual*, y **commitea** si el modo git lo permite.
6. **Cerrar el turno limpio:** deja `PLAN.md` coherente y el árbol en verde.

## Definición de "hecho" (Definition of Done)

Cumple su **criterio de aceptación**, pasa build/tests/lint, respeta las convenciones, no deja
`TODO` en el código, está reflejado en `PLAN.md` (y commiteado si procede). Para features de UI:
verificada en el navegador; para BFF: verificada con un test e2e (supertest) o petición real.

## Cómo retomar tras `/compact`

El `/compact` borra el contexto conversacional, **no** el disco:

1. Lee `docs/PLAN.md` (checklist + *Estado actual* + *Decisiones*) y `git log`.
2. Repite la **puerta de clarificación**: ¿surgió algo esencial no decidido? Pregunta antes de seguir.
3. Continúa por el primer ítem no marcado. Si algo quedó a medias, *Estado actual* dice dónde
   retomar; si no lo dice, deduce lo mínimo del `git log`/diff, anótalo y sigue.

## Reglas de oro

- **No trabajes sobre suposiciones esenciales.** Preguntar > adivinar.
- **El estado vive en disco** (`PLAN.md` + git), no solo en tu respuesta.
- **Pasos pequeños y verificados.** Commits atómicos = puntos de retorno seguros.
- **No amplíes el alcance** por tu cuenta: lo que no esté en `PLAN.md` se propone, no se hace.
- **El contrato no se escribe a mano.** Los tipos del API salen de `packages/contract` (generados del
  OpenAPI de NexusMQ). Si falta un campo, es el spec el que manda.
- **Registra aprendizajes transversales como ADR** (`docs/adr/adr-NNNN-*.md`): trampas de toolchain,
  patrones, decisiones de arquitectura. Son la materia prima con la que, al terminar, se enriquece la
  biblioteca. No edites la biblioteca a mitad de proyecto: primero el ADR.

## Comandos del proyecto (parte variable)

> Válidos una vez montado el andamiaje (Fase 0). Se ejecutan en la raíz del monorepo salvo indicación.

- **Instalar:** `pnpm install`
- **Build (todo):** `pnpm build`  ·  **Dev (todo):** `pnpm dev`
- **Tests:** `pnpm test`  ·  **Lint:** `pnpm lint`  ·  **Typecheck:** `pnpm typecheck`
- **Regenerar contrato:** `pnpm --filter @nexusmq/contract generate`
- **Arranque local:** `pnpm --filter @nexusmq/bff dev` (BFF) · `pnpm --filter @nexusmq/web dev` (SPA)
