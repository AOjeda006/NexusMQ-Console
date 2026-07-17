# syntax=docker/dockerfile:1
# =============================================================================
# NexusMQ Console — imagen de la consola (BFF NestJS que sirve la SPA React).
#
# Multi-stage: `builder` compila el monorepo (SPA + BFF); `runtime` solo ejecuta
# el BFF sobre una base mínima, como usuario **no-root** y con **HEALTHCHECK**
# propio. El broker NexusMQ y Prometheus son **externos**: se apuntan por
# variables de entorno (nunca se hornean en la imagen).
# =============================================================================

# --- Etapa de build: compila SPA + BFF y aísla las deps de producción --------
FROM node:22-slim AS builder
WORKDIR /repo

# pnpm vía corepack (respeta `packageManager` del package.json raíz).
RUN corepack enable

# 1) Manifiestos primero: capa de dependencias cacheable (no se invalida al
#    cambiar el código). Lockfile + todos los package.json del workspace.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/bff/package.json apps/bff/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# 2) Código y build: genera el contrato tipado y compila web (Vite) + bff (tsc).
COPY . .
RUN pnpm generate && pnpm build

# 3) Bundle de producción **aislado** del BFF: un node_modules autocontenido con
#    solo las deps de runtime (sin devDeps ni @nexusmq/contract, que es type-only)
#    y el dist compilado. `--legacy` porque el workspace no inyecta paquetes.
RUN pnpm --filter @nexusmq/bff --legacy deploy --prod /out

# --- Etapa de runtime: mínima, no-root, solo el artefacto --------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST_PATH=/app/web
WORKDIR /app

# Artefacto: node_modules de producción + dist del BFF + build de la SPA.
# `node:22-slim` ya trae el usuario no-root `node` (uid 1000); se le asigna la
# propiedad de los ficheros al copiar.
COPY --from=builder --chown=node:node /out/node_modules ./node_modules
COPY --from=builder --chown=node:node /out/dist ./dist
COPY --from=builder --chown=node:node /out/package.json ./package.json
COPY --from=builder --chown=node:node /repo/apps/web/dist ./web

USER node
EXPOSE 3000

# HEALTHCHECK en la propia imagen: comprueba que el BFF **responde de verdad**
# (no solo que el proceso siga vivo), para que el orquestador reinicie
# instancias enfermas. Usa el `fetch` nativo de Node 22 (sin curl en la base).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
