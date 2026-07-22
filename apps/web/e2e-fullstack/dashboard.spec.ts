import { expect, test } from '@playwright/test';

const GOOD_TOKEN = 'good-operator-token';

/** Inicia sesión pegando el token válido; tras login se aterriza en el Dashboard (`/`). */
async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Token de operador').fill(GOOD_TOKEN);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Sesión activa')).toBeVisible();
}

/**
 * E2E full-stack del **Dashboard vivo** (F3.1). Topología de producción: el BFF
 * sirve la SPA y proxya `/api/*` al doble del broker (métricas por SSE, cluster
 * protegido). Verifica que el panel refleja **cambios reales en < 2 s** (AC),
 * dibuja las gráficas y muestra el estado Raft.
 */
test('el Dashboard muestra métricas en vivo, gráficas y estado Raft del broker vía BFF', async ({
  page,
}) => {
  await login(page);

  const dashboard = page.getByTestId('dashboard');
  await expect(dashboard).toBeVisible();

  // 1) Flujo en vivo por SSE (el BFF reemite los frames del doble del broker).
  await expect(dashboard).toHaveAttribute('data-status', 'live');
  await expect(dashboard).toHaveAttribute('data-source', 'sse');

  // 2) AC de F3.1: refleja cambios reales del broker en < 2 s. El contador de
  //    muestras (una por frame SSE) tiene que avanzar dentro de esa ventana.
  const samples0 = Number(await dashboard.getAttribute('data-samples'));
  await expect
    .poll(async () => Number(await dashboard.getAttribute('data-samples')), { timeout: 2000 })
    .toBeGreaterThan(samples0);

  // 3) KPIs con datos reales del broker (nexus_broker_*, filtrados por api):
  //    throughput produce/fetch en req/s (F5.2: dejan de mostrar «—»), latencia
  //    p99 en ms y salud del clúster (3 nodos).
  const produceKpi = page.getByTestId('kpi-produce');
  const fetchKpi = page.getByTestId('kpi-fetch');
  await expect(produceKpi).toContainText('req/s');
  await expect(fetchKpi).toContainText('req/s');
  await expect
    .poll(async () => (await produceKpi.innerText()).includes('—'), { timeout: 2000 })
    .toBe(false);
  await expect(page.getByTestId('kpi-p99')).toContainText('ms');
  // Conexiones activas (gauge por plane) con desglose real (F5.3).
  const connectionsKpi = page.getByTestId('kpi-connections');
  await expect(connectionsKpi).toContainText('conexiones');
  await expect(connectionsKpi).toContainText('native');
  const clusterKpi = page.getByTestId('kpi-cluster');
  await expect(clusterKpi).toContainText('3');
  await expect(clusterKpi).toContainText('Saludable');

  // 4) Las dos gráficas de alta frecuencia (uPlot) se dibujan en <canvas>.
  await expect(page.getByRole('heading', { name: 'Throughput (peticiones/s)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Latencia de servicio/ })).toBeVisible();
  expect(await page.locator('canvas').count()).toBeGreaterThanOrEqual(2);

  // 5) Estado Raft real: nodo local + una partición liderada del broker.
  const clusterPanel = page.getByTestId('cluster-panel');
  await expect(clusterPanel).toContainText('Nodo 1');
  await expect(clusterPanel).toContainText('(local)');
  await expect(clusterPanel.getByText('orders.events-p0')).toBeVisible();
  await expect(clusterPanel.getByText('Líder').first()).toBeVisible();
});
