import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

/**
 * E2E **full-stack** de la capa de datos (F2.2). Verifica el camino de
 * producción real: el **BFF** sirve el build de la SPA y proxya `/api/*` a un
 * **doble del broker**, con la cookie de sesión httpOnly de por medio (mismo
 * origen). No se mockea la red: se ejercita SPA → BFF → broker de verdad.
 *
 * `NODE_ENV` se deja sin fijar a propósito: así la cookie de sesión **no** es
 * `Secure` y el navegador la guarda sobre `http://127.0.0.1`. Requiere que
 * `apps/web` y `apps/bff` estén construidos (el script `test:e2e:data` lo hace).
 */
const rootDir = dirname(fileURLToPath(import.meta.url));
const BROKER_PORT = 4319;
const BFF_PORT = 4318;
const PROMETHEUS_PORT = 4320;
const GOOD_TOKEN = 'good-operator-token';
const BASE_URL = `http://127.0.0.1:${BFF_PORT}`;

export default defineConfig({
  testDir: './e2e-fullstack',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e-fullstack/fake-broker.mjs',
      cwd: rootDir,
      env: { FAKE_BROKER_PORT: String(BROKER_PORT), FAKE_BROKER_TOKEN: GOOD_TOKEN },
      url: `http://127.0.0.1:${BROKER_PORT}/healthz`,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    },
    {
      command: 'node e2e-fullstack/fake-prometheus.mjs',
      cwd: rootDir,
      env: { FAKE_PROMETHEUS_PORT: String(PROMETHEUS_PORT) },
      url: `http://127.0.0.1:${PROMETHEUS_PORT}/-/healthy`,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    },
    {
      command: 'node dist/main.js',
      cwd: resolve(rootDir, '../bff'),
      env: {
        PORT: String(BFF_PORT),
        BROKER_ADMIN_URL: `http://127.0.0.1:${BROKER_PORT}`,
        PROMETHEUS_URL: `http://127.0.0.1:${PROMETHEUS_PORT}`,
        SESSION_SECRET: 'e2e-session-secret-abcdefghijklmnopqrstuvwxyz-0123',
        WEB_DIST_PATH: resolve(rootDir, 'dist'),
      },
      url: `${BASE_URL}/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    },
  ],
});
