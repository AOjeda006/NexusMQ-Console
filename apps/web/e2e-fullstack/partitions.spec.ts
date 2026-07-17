import { expect, test } from '@playwright/test';

const SHOTS_DIR =
  'C:/Users/Predator/AppData/Local/Temp/claude/c--Users-Predator-Desktop-PROGRAMACION-PROYECTOS-Y-REPOS-NexusMQ-Console/ee8c41d0-eca4-4744-8475-bd8f764e1a1f/scratchpad';

const GOOD_TOKEN = 'good-operator-token';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Token de operador').fill(GOOD_TOKEN);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Sesión activa')).toBeVisible();
}

/**
 * E2E full-stack del **detalle de particiones** (F3.4): al describir un topic, la
 * tabla de particiones cruza el describe (líder, HWM, época) con el estado Raft
 * del clúster para mostrar el **lag de réplica**. Las particiones replicadas del
 * nodo tienen lag numérico; las que no están en el consenso muestran «—».
 */
test('el detalle del topic muestra particiones con lag de réplica del consenso Raft', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Topics' }).click();
  await expect(page).toHaveURL(/\/topics$/);

  await page.getByRole('button', { name: 'orders.events', exact: true }).click();
  const detail = page.getByTestId('topic-detail');
  await expect(detail).toBeVisible();

  // orders.events tiene 6 particiones; la tabla añade la columna de lag de réplica.
  await expect(detail.getByText('Particiones (6)')).toBeVisible();
  await expect(detail.getByText('Lag réplica')).toBeVisible();
  await expect(detail.getByTestId('partition-lag')).toHaveCount(6);

  // p0 está replicada en el consenso (líder de este nodo): lag numérico, no «—».
  await expect(detail.getByTestId('partition-lag').first()).not.toHaveText('—');
  // p3 no está en el consenso (no la lidera este nodo): lag «—», coherente con describe.
  await expect(detail.getByTestId('partition-lag').nth(3)).toHaveText('—');

  await page.screenshot({ path: `${SHOTS_DIR}/f34-partitions.png`, fullPage: true });
});
