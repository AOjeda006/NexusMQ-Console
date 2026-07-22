# 16. Puerta de calidad y CI/CD

> Lo que tiene que estar verde antes de cada *push*. La puerta es **obligatoria**, se ejecuta
> en local y el CI la replica. Nunca se sube en rojo.

## 16.1 La puerta, en orden

```bash
pnpm install --frozen-lockfile
pnpm generate            # tipos del OpenAPI (openapi-typescript)
pnpm lint                # eslint
pnpm format:check        # prettier --check
pnpm typecheck           # tsc --noEmit en los 3 paquetes
pnpm build               # vite build + tsc
pnpm test                # unitario + integración (105)

pnpm --filter @nexusmq/web test:e2e        # e2e SPA (7, Chromium)
pnpm --filter @nexusmq/web test:e2e:data   # e2e full-stack (14)
```

El orden no es arbitrario:

- **`generate` va antes que todo lo demás.** Sin los tipos del contrato, `typecheck`, `build` y
  `test` no tienen nada válido contra lo que compilar. Turborepo lo encadena como dependencia,
  pero en el CI se hace explícito para que un fallo ahí se lea en su propio paso.
- **`lint` y `format:check` van antes que `typecheck`.** Son los más rápidos; fallar pronto
  ahorra minutos.
- **Los e2e van al final.** Necesitan artefactos construidos y levantan procesos reales.

## 16.2 Qué garantiza cada paso

| Paso | Herramienta | Qué impide que entre |
| ---- | ----------- | -------------------- |
| `generate` | `openapi-typescript` | Que el contrato vendorizado y los tipos diverjan. |
| `lint` | ESLint 9 (flat config) + `typescript-eslint` + reglas de React Hooks | Dependencias de hooks mal declaradas, `any` implícitos, importaciones desordenadas. |
| `format:check` | Prettier | Ruido de estilo en los *diffs*. |
| `typecheck` | `tsc --noEmit` en los 3 paquetes | Roturas de contrato, tipos incompatibles. Es el detector de cambios del broker. |
| `build` | Vite (SPA) + `tsc` (BFF y contract) | Que algo compile en desarrollo pero no en producción. |
| `test` | Vitest (+ supertest) | Regresiones de lógica y de endpoints. |
| `test:e2e` | Playwright / Chromium | Regresiones visuales, de tema y de contraste AA. |
| `test:e2e:data` | Playwright full-stack | Regresiones de integración real SPA → BFF → broker. |

`typecheck` merece énfasis: es el mecanismo por el que un cambio del contrato del broker se
manifiesta como **error de compilación** en cada punto afectado, en lugar de como un
`undefined` en producción. Es la razón de que el contrato se genere y no se escriba.

## 16.3 ESLint y Prettier: responsabilidades separadas

- **ESLint** decide sobre **corrección**: hooks, tipos, patrones peligrosos. `eslint-config-prettier`
  desactiva sus reglas estéticas para que no compita con Prettier.
- **Prettier** decide sobre **formato**, y su `.prettierignore` excluye tres cosas a propósito:
  - los **artefactos generados** (`packages/contract/src/generated`, `dist`, `coverage`);
  - el **`openapi.yaml` vendorizado** — es una copia fiel del broker; reformatearlo produciría
    un *diff* espurio en cada sincronización;
  - los **Markdown** — la documentación tiene saltos de línea, tablas y diagramas Mermaid
    intencionados. Prettier formatea código y configuración, no prosa.

El paso `format:check` en el CI se añadió al cerrar el proyecto: hasta entonces la comprobación
existía como script pero no como puerta, y unos veinte ficheros habían derivado. Una regla sin
gate es una sugerencia.

## 16.4 El pipeline de CI

`.github/workflows/ci.yml`, en cada *push* a `main` y en cada *pull request*:

```yaml
jobs:
  verify:
    name: install · lint · format · typecheck · build · test
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Instalar pnpm            # pnpm/action-setup@v4
      - Configurar Node          # node-version-file: .nvmrc  (Node 22 LTS) + cache: pnpm
      - Instalar dependencias    # pnpm install --frozen-lockfile
      - Generar contrato         # pnpm generate
      - Lint                     # pnpm lint
      - Format                   # pnpm format:check
      - Typecheck                # pnpm typecheck
      - Build                    # pnpm build
      - Test                     # pnpm test
```

Con `permissions: contents: read` (mínimo privilegio) y `concurrency` con
`cancel-in-progress`, para que un *push* nuevo cancele el run anterior de la misma rama.

La versión de Node sale de `.nvmrc`, el mismo fichero que usa el desarrollo local: **una sola
fuente de verdad** para la versión del runtime.

`--frozen-lockfile` es lo que convierte el CI en una verificación real: si alguien tocó un
`package.json` sin actualizar el *lockfile*, el CI falla en lugar de instalar silenciosamente
otra cosa.

## 16.5 Caché e incrementalidad

Turborepo cachea por tarea y por hash de entradas, tanto en local como en CI (con la caché de
pnpm de `actions/setup-node`). En la práctica, un cambio que solo toca la SPA no vuelve a
compilar ni probar el BFF.

La tarea `dev` declara `passThroughEnv` con sus nueve variables. Turborepo 2.x usa *env-mode*
estricto: sin esa declaración filtra las variables no listadas, y el BFF arrancaba con el
entorno vacío y abortaba en la validación de configuración. La caché no se ve afectada —
`passThroughEnv` no entra en el hash.

## 16.6 Los e2e no están en el CI (y por qué)

El workflow ejecuta hasta `test`. Las dos suites Playwright se ejecutan **en local** antes de
cada *push*.

Es una decisión consciente sobre el coste: los e2e full-stack levantan tres procesos, requieren
Chromium descargado y construyen ambos artefactos. Añadirlos al workflow multiplicaría el
tiempo de cada *push* a cambio de repetir una verificación que ya se hizo con el navegador
delante.

Es también una **limitación conocida**: si alguien contribuyera sin ejecutar los e2e, el CI no
lo detectaría. Está anotada como trabajo futuro en el
[capítulo 19](./19-limitaciones-y-trabajo-futuro.md); la solución natural es un job aparte con
`playwright install --with-deps chromium` y ejecución solo en `main` o bajo etiqueta.

## 16.7 Definición de "hecho"

Un cambio está terminado cuando:

1. cumple su criterio de aceptación;
2. pasa la puerta completa, e2e incluidos;
3. respeta las convenciones (arquitectura, naming, errores, seguridad);
4. **no deja `TODO` en el código** — lo pendiente se documenta, no se comenta;
5. si tiene superficie de *runtime*, **se ha arrancado y comprobado de verdad**: la vista
   pinta, el endpoint responde, el SSE emite.

El punto 5 es el que separa "compila" de "funciona", y es donde aparecieron casi todos los
problemas interesantes del proyecto.
