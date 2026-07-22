import { expect, test } from '@playwright/test';

const GOOD_TOKEN = 'good-operator-token';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Token de operador').fill(GOOD_TOKEN);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Sesión activa')).toBeVisible();
}

/**
 * E2E full-stack de **Cluster / Raft** (F3.5): nodos, consenso por partición y la
 * **topología 3D** (react-three-fiber) que responde a la partición seleccionada.
 * Verifica que al elegir otra partición con distinto líder, la escena lo refleja.
 */
test('muestra nodos, consenso Raft y la topología 3D que responde al líder', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Cluster' }).click();
  await page.waitForURL(/\/cluster$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cluster' })).toBeVisible();

  // La topología 3D (WebGL, carga diferida) se dibuja en un <canvas>.
  const topology = page.getByRole('img', { name: /Topología 3D del clúster/ });
  await expect(topology).toBeVisible();
  await expect(topology.locator('canvas')).toBeVisible();

  // Partición activa por defecto = primera (orders.events-p0), líder Nodo 1.
  const leader = page.getByTestId('topology-leader');
  await expect(leader).toContainText('orders.events-p0');
  await expect(leader).toContainText('Nodo 1');

  // Seleccionar una partición con distinto líder ⇒ la topología responde.
  await page.getByRole('button', { name: 'orders.events-p2' }).click();
  await expect(leader).toContainText('orders.events-p2');
  await expect(leader).toContainText('Nodo 2');
});
