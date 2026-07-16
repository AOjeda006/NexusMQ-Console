import { expect, test } from '@playwright/test';

const SHOTS_DIR =
  'C:/Users/Predator/AppData/Local/Temp/claude/c--Users-Predator-Desktop-PROGRAMACION-PROYECTOS-Y-REPOS-NexusMQ-Console/ee8c41d0-eca4-4744-8475-bd8f764e1a1f/scratchpad';

const GOOD_TOKEN = 'good-operator-token';

/** Inicia sesión pegando el token válido y espera a entrar al shell. */
async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Token de operador').fill(GOOD_TOKEN);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Sesión activa')).toBeVisible();
}

test('sin sesión y con broker en modo secreto, la raíz redirige al login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeVisible();
});

test('un deep link protegido también redirige al login (guard)', async ({ page }) => {
  await page.goto('/topics');
  await expect(page).toHaveURL(/\/login$/);
});

test('un token inválido muestra el error RFC 7807 del BFF y no entra', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Token de operador').fill('token-incorrecto');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('alert')).toContainText('Token rechazado');
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: `${SHOTS_DIR}/f22-login-error.png`, fullPage: true });
});

test('login válido entra y Topics lista los topics reales del broker vía BFF', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL((url) => !url.pathname.startsWith('/login'));

  await page.getByRole('link', { name: 'Topics' }).click();
  await expect(page).toHaveURL(/\/topics$/);

  // Datos reales servidos por el doble del broker a través del BFF.
  await expect(page.getByRole('cell', { name: 'orders.events' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'payments.settled' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'telemetry.raw' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS_DIR}/f22-topics.png`, fullPage: true });

  // La cookie de sesión httpOnly persiste la sesión al recargar.
  await page.reload();
  await expect(page).toHaveURL(/\/topics$/);
  await expect(page.getByRole('cell', { name: 'orders.events' })).toBeVisible();
});

test('cerrar sesión invalida la sesión y el guard vuelve al login', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
