# 5. Principios de diseño

> Las reglas que gobiernan las decisiones de toda la consola. Cada una se aplica en varios
> capítulos; aquí se enuncian una sola vez, con su *rationale* y su coste.

## 5.1 El contrato es la fuente de verdad, y no se escribe a mano

Todo tipo que describa un dato del broker **se genera**. `openapi-typescript` produce
`packages/contract/src/generated/schema.ts` desde el `openapi.yaml` vendorizado, y de ahí
salen las respuestas, los cuerpos, los parámetros y hasta el `ProblemDetail` de los errores.

La consecuencia práctica es que **un cambio de contrato rompe la compilación, no la
producción**. Si el broker renombra un campo, `pnpm typecheck` falla en cada punto que lo
usaba. Es exactamente donde queremos que falle.

El coste: hay que resistir la tentación de "ajustar a mano un tipito". El directorio
generado está en `.gitignore` precisamente para que nadie lo edite y para que el build
siempre lo regenere.

## 5.2 El BFF es la frontera de confianza

No es una capa de conveniencia: es **la** decisión de seguridad del proyecto. Todo lo que
importa está de su lado:

- la **URL del broker** (el navegador no la conoce);
- el **JWT del operador** (vive en un `Map` en servidor, con TTL);
- la **construcción de la PromQL** (el cliente solo elige un id de una lista cerrada);
- la **validación de entrada** (Zod, allow-list, antes de tocar la red).

La regla derivada es sencilla de auditar: **si un dato viaja al navegador, es porque el
navegador puede verlo sin riesgo**. La consola tiene tests que lo comprueban sobre el caso
más sensible —el token del broker no aparece en el cuerpo, ni en las cabeceras, ni en la
cookie de ninguna respuesta.

## 5.3 Inversión de dependencias en ambos lados

En el BFF, la inversión es la de NestJS: **DI por constructor**, servicios detrás de
interfaces implícitas, controllers finos que no saben *cómo* se habla con el broker, solo
*qué* piden. `BrokerService` encapsula undici, el dispatcher TLS y la construcción de URL;
si mañana el transporte cambia, el cambio no sale de ese fichero.

En la SPA, la inversión toma otra forma: **la lógica pura no depende de React**. Los módulos
que calculan cuantiles, derivan tasas, construyen ventanas temporales o alinean series son
funciones puras en ficheros sin `import React`. Los hooks (`use-*.ts`) son adaptadores
delgados que conectan esa lógica con TanStack Query y con el ciclo de vida del componente.
Por eso el 100 % de las pruebas unitarias de la SPA son de lógica pura y ninguna necesita
montar un DOM.

## 5.4 Controllers finos, servicios con la lógica

Ningún controller del BFF contiene una decisión de negocio. El patrón, repetido en los cinco
controllers de proxy, es siempre el mismo:

```ts
@Get()
async list(
  @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  @BrokerToken() token: string | undefined,
  @Res() res: Response,
): Promise<void> {
  const result = await this.broker.forward({ method: 'GET', path: '…', query, token });
  sendProxyResult(res, result);
}
```

Validar en el borde, delegar, reemitir. Un controller que crece es la señal de que falta un
servicio.

## 5.5 Passthrough: no reinterpretar el dominio ajeno

El BFF **no traduce** las respuestas del broker. Captura status, `Content-Type`, cuerpo y
`Location`, y los reemite *verbatim*. No normaliza campos, no añade envolturas, no convierte
un 409 en un 400 "más bonito".

La razón es que cualquier traducción introduce una segunda definición del dominio que puede
divergir de la primera. Si el broker devuelve un `409 Conflict` con un `problem+json`
explicando que el topic ya existe, ese es el mejor error posible: el BFF no tiene información
adicional que aportar y sí muchas formas de estropearlo.

La excepción es acotada y explícita: el BFF **sí** genera errores propios cuando el fallo es
suyo —validación de entrada (400) o imposibilidad de contactar con el broker (502)— y cuando
la ruta es suya (auth, historia). Ver [capítulo 14](./14-modelo-de-errores.md).

## 5.6 Degradación honesta

Cuando falta un dato, la interfaz lo **dice**. No hay ceros de relleno, no hay gráficas
vacías sin explicación, no hay estados de carga infinitos.

Esto se aplica en tres niveles:

| Situación | Comportamiento |
| --------- | -------------- |
| Una familia de métricas que el broker no emite | El tile muestra «—» y su línea de apoyo también. |
| Prometheus no configurado | La vista de Historia muestra un aviso con el nombre de la variable que falta; el resto de la consola sigue igual. |
| Clúster de un solo nodo con RF=1 | La topología muestra el nodo con su halo y el texto «sin particiones replicadas», no un error. |
| Sin grupos de consumo | *Empty state* explícito, no una tabla vacía. |

El principio detrás: **un cero es una afirmación**. Mostrar `0 msg/s` cuando en realidad no
sabemos el valor es mentir en la dirección más peligrosa, porque se lee como "todo tranquilo".

## 5.7 Fail-fast en la configuración

El BFF valida **todo** su entorno con un esquema Zod en el constructor de `ConfigService`. Si
falta `BROKER_ADMIN_URL`, si `SESSION_SECRET` tiene menos de 32 caracteres o si una URL está
mal formada, el proceso imprime qué clave falla y por qué, y sale con código 1.

Nunca arranca en un estado medio válido. Un orquestador ve el fallo inmediatamente en el
primer arranque, no tres horas después cuando alguien intenta iniciar sesión.

## 5.8 Accesibilidad como restricción, no como repaso

Dos reglas duras, verificadas por tests:

- **Contraste AA (≥ 4.5:1)** del texto sobre página y sobre superficie, en claro **y** en
  oscuro. Hay una prueba Playwright que lo mide sobre el DOM real.
- **El color nunca es el único portador de información.** Cada estado lleva icono y etiqueta:
  el badge de salud, el estado de un grupo, el aviso de error, la tasa de error del
  Dashboard. En las gráficas, la leyenda nombra las series.

## 5.9 Verificar en el navegador, no solo en el test unitario

Una función pura verificada no prueba que la pantalla funcione. Cada feature con superficie
visual se comprobó **arrancando la aplicación**: Playwright sobre el build de producción para
la SPA, y sobre la **topología de producción completa** (BFF real sirviendo la SPA y
proxyando a un doble del broker) para todo lo que cruza la red.

Es la razón de que la suite full-stack levante tres procesos y de que no haya un solo
`page.route()` sustituyendo a la API en esas 14 pruebas, salvo donde el objetivo del test es
precisamente forzar una respuesta degradada.
