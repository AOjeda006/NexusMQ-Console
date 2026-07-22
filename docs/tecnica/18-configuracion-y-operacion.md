# 18. Configuración y operación

> Todas las variables de entorno del BFF, cómo se validan, y las tareas habituales de
> operación: arrancar en local, diagnosticar, y qué mirar cuando algo no va.

## 18.1 Configuración por entorno, validada al arrancar

La consola es **12-factor**: toda su configuración entra por variables de entorno, y el mismo
artefacto sirve para todos los despliegues. No hay ficheros de configuración por entorno, ni
builds distintos para desarrollo y producción.

El esquema Zod de `config.schema.ts` es una **allow-list**: solo estas claves, con su tipo,
su rango y su valor por defecto. `validateEnv()` es una función pura (y por tanto testeable) que
se invoca desde el constructor de `ConfigService`; un fallo lanza `ConfigValidationError` con el
detalle **por clave** y `main.ts` sale con código 1.

```
Configuración de entorno inválida:
  - BROKER_ADMIN_URL: requerida: URL del plano admin del broker
  - SESSION_SECRET: debe tener al menos 32 caracteres
Corrige las variables y reinicia el BFF.
```

Nunca arranca a medias. Es la aplicación del principio *fail-fast*
([capítulo 5](./05-principios-de-diseno.md), §5.7).

## 18.2 Variables de entorno

Plantilla completa en [`.env.example`](../../.env.example).

| Variable | Obligatoria | Por defecto | Descripción |
| -------- | ----------- | ----------- | ----------- |
| `SESSION_SECRET` | **Sí** | — | Firma la cookie de sesión `httpOnly`. **≥ 32 caracteres** (`openssl rand -hex 32`). |
| `BROKER_ADMIN_URL` | **Sí** | — | URL del plano de operación (admin) del broker. Validada como URL. |
| `PROMETHEUS_URL` | No | — | Data source de historia. Sin él, la vista de Historia **degrada limpio**. |
| `SESSION_TTL_HOURS` | No | `8` | TTL de la sesión de operador (máx. 720). Vencida, se purga y se exige re-login. |
| `CONSOLE_REQUIRE_LOGIN` | No | `true` | Exige sesión **siempre**, aunque el broker esté en modo abierto. `false` espeja el modo del broker. |
| `PORT` | No | `3000` | Puerto de escucha. |
| `NODE_ENV` | No | `development` (`production` en la imagen) | `production` ⇒ cookie `Secure` + HSTS + servido estático. |
| `BROKER_TLS_REJECT_UNAUTHORIZED` | No | `true` | Validar el certificado TLS del broker al proxyar. |
| `NODE_EXTRA_CA_CERTS` | No | — | Ruta a un PEM con CAs adicionales (lo lee Node de forma nativa). |
| `WEB_DIST_PATH` | No | `/app/web` (en la imagen) | Directorio del build de la SPA. Si no apunta a uno con `index.html`, no se sirve SPA. |

### Notas de operación por variable

- **`SESSION_SECRET`** — cambiarlo **invalida todas las sesiones** en curso. Es el
  comportamiento correcto para una rotación, pero implica que todos los operadores vuelven a
  entrar. No hay rotación gradual.
- **`CONSOLE_REQUIRE_LOGIN`** — dejarlo en `true` salvo que otra capa (un proxy con SSO, una
  VPN) ya autentique. Ponerlo en `false` con el broker en modo abierto deja la consola
  **pública**.
- **`BROKER_TLS_REJECT_UNAUTHORIZED=false`** — solo para desarrollo con certificados
  autofirmados. En producción, la respuesta correcta es `NODE_EXTRA_CA_CERTS` con la CA propia.
- **`SESSION_TTL_HOURS`** — el `maxAge` de la cookie se alinea automáticamente, así que no hay
  cookies que sobrevivan a su sesión de servidor.

## 18.3 Puesta en marcha en local

```bash
pnpm install
pnpm --filter @nexusmq/contract generate

export BROKER_ADMIN_URL=http://localhost:8080
export SESSION_SECRET="$(openssl rand -hex 32)"
pnpm dev        # BFF (:3000) + SPA con HMR (:5173)
```

La SPA se abre en `http://localhost:5173`; Vite proxya `/api`, `/health`, `/healthz` y
`/readyz` al BFF, de modo que el navegador ve **un solo origen** también en desarrollo y la
cookie se comporta igual que en producción.

Para probar contra un broker real en modo secreto: arráncalo con `--jwt-secret`, emite un JWT
HS256 con ese secreto y pégalo en el login de la consola.

> **Nota de plataforma.** Si el broker corre en WSL y la consola en Windows (o viceversa),
> `BROKER_ADMIN_URL` debe apuntar a la IP alcanzable entre ambos, no a `localhost`. Y para
> probar sesión sobre `http://`, deja `NODE_ENV` sin fijar (o en `development`) para que la
> cookie no sea `Secure`.

## 18.4 Scripts disponibles

| Comando | Efecto |
| ------- | ------ |
| `pnpm dev` | BFF + SPA en desarrollo. |
| `pnpm build` | Build de producción de todo el monorepo. |
| `pnpm test` | Unitario + integración. |
| `pnpm lint` · `pnpm typecheck` | Calidad estática. |
| `pnpm format` · `pnpm format:check` | Formato (escribe / comprueba). |
| `pnpm --filter @nexusmq/contract sync:openapi` | Re-descarga el OpenAPI del broker. |
| `pnpm --filter @nexusmq/contract generate` | Regenera tipos + cliente. |
| `pnpm --filter @nexusmq/web test:e2e` | e2e de la SPA. |
| `pnpm --filter @nexusmq/web test:e2e:data` | e2e full-stack. |

## 18.5 Diagnóstico

Qué mirar primero según el síntoma:

| Síntoma | Comprobación | Causa habitual |
| ------- | ------------ | -------------- |
| El BFF no arranca | Su log: dice **qué clave** falla | Falta `BROKER_ADMIN_URL` o `SESSION_SECRET`, o `SESSION_SECRET` es corto. |
| Todo da 502 | `GET /healthz` (proxied al broker) | Broker inalcanzable: DNS, red, `BROKER_ADMIN_URL` mal, o TLS rechazado. |
| Redirige al login en bucle | `GET /api/auth/session` | La cookie no se guarda: `NODE_ENV=production` sobre HTTP ⇒ cookie `Secure` descartada. |
| 401 tras un rato | TTL de sesión | `SESSION_TTL_HOURS` vencido; el BFF purga y exige re-login. |
| Historia vacía con aviso | `GET /api/history/status` | `PROMETHEUS_URL` no configurada (degradación, no fallo). |
| Historia da 502 | Prometheus directamente | Prometheus configurado pero caído o inalcanzable. |
| Dashboard con todo «—» | Snapshot: nombres de las series | El broker emite otros nombres → revisar su catálogo de métricas ([capítulo 11](./11-observabilidad-y-metricas.md)). |
| El SSE no llega | Cabeceras de la respuesta a `/api/v1/stream` | Proxy inverso bufferizando: falta desactivarlo para esa ruta. |
| Grupos vacíos / Raft sin aristas | Estado real del broker | No es un bug: single-node con RF=1 no tiene réplicas, y sin consumidores no hay grupos. |

Los logs del BFF usan el `Logger` de Nest con contexto por clase (`AuthService`,
`BrokerService`, `StreamService`, `SecurityHeaders`, `StaticHosting`). **Nunca** registran el
token del operador ni el contenido de la cookie.

Mensajes de arranque útiles para verificar un despliegue:

```
[SecurityHeaders] Cabeceras de seguridad activas (CSP con 1 hash(es) inline).
[StaticHosting]   Sirviendo la SPA desde /app/web
[Bootstrap]       BFF escuchando en http://localhost:3000
```

Si falta el de `StaticHosting`, `WEB_DIST_PATH` no apunta a un directorio con `index.html` y la
consola servirá la API pero no la interfaz. Si la CSP dice «0 hash(es)», tampoco encontró el
index.

## 18.6 Operación habitual

**Iniciar sesión.** El operador pega un JWT del broker ya emitido. El BFF lo valida contra el
broker y lo confina en servidor; al navegador solo va la cookie. Ver
[capítulo 9](./09-autenticacion-y-sesiones.md).

**Cambiar de broker.** Se hace **por entorno**, no desde la interfaz: modifica
`BROKER_ADMIN_URL` y reinicia. La interfaz no lo permite a propósito
([capítulo 13](./13-seguridad.md), §13.7).

**Actualizar el contrato tras un cambio del broker.**

```bash
pnpm --filter @nexusmq/contract sync:openapi
pnpm generate && pnpm typecheck
```

Y si cambiaron **nombres de métrica**, revisar el catálogo del broker: eso el `typecheck` no lo
detecta, porque son cadenas.

**Apagado ordenado.** `enableShutdownHooks()` hace que `SIGTERM`/`SIGINT` detengan el barrido
de sesiones y cierren los SSE en vuelo. Un despliegue rodante no deja streams huérfanos.

**Escalar.** Las sesiones viven en memoria de **una** instancia. Con varias réplicas, un
operador solo funcionaría contra la que le dio la sesión, salvo que el balanceador use sesiones
pegajosas. Escalado horizontal real requiere un almacén compartido — ver
[capítulo 19](./19-limitaciones-y-trabajo-futuro.md).
