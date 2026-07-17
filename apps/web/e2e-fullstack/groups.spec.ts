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
 * E2E full-stack de **Grupos** (F3.3): listar y describir (miembros, offsets y
 * lag por partición) contra el doble del broker vía BFF.
 */
test('lista grupos y describe miembros, offsets y lag real por partición', async ({ page }) => {
  await login(page);

  await page.getByRole('link', { name: 'Grupos' }).click();
  await expect(page).toHaveURL(/\/groups$/);

  // Lista real con estado por grupo.
  await expect(page.getByRole('button', { name: 'analytics-pipeline' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'billing-consumers' })).toBeVisible();
  await expect(page.getByText('Estable').first()).toBeVisible();

  // Describir: miembros (con líder) y offsets con lag por partición.
  await page.getByRole('button', { name: 'analytics-pipeline' }).click();
  const detail = page.getByTestId('group-detail');
  await expect(detail).toBeVisible();
  await expect(detail.getByText('member-a')).toBeVisible();
  await expect(detail.getByText('líder')).toBeVisible();
  await expect(detail.getByText('Miembros (2)')).toBeVisible();

  // Lag real por partición: p0 va 200 por detrás; el lag total es 350 (200+0+150).
  await expect(detail.getByTestId('offset-lag').first()).toHaveText('200');
  await expect(detail.getByText('350', { exact: true })).toBeVisible();

  await page.screenshot({ path: `${SHOTS_DIR}/f33-group-detail.png`, fullPage: true });
});
