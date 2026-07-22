import { expect, test } from '@playwright/test';

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
});

test('login válido entra y Topics lista los topics reales del broker vía BFF', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL((url) => !url.pathname.startsWith('/login'));

  await page.getByRole('link', { name: 'Topics' }).click();
  await expect(page).toHaveURL(/\/topics$/);

  // Datos reales servidos por el doble del broker a través del BFF (nombre exacto:
  // la consola ya muestra celdas «orders.events-pN» en el panel Raft).
  await expect(page.getByRole('cell', { name: 'orders.events', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'payments.settled', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'telemetry.raw', exact: true })).toBeVisible();

  // La cookie de sesión httpOnly persiste la sesión al recargar.
  await page.reload();
  await expect(page).toHaveURL(/\/topics$/);
  await expect(page.getByRole('cell', { name: 'orders.events', exact: true })).toBeVisible();
});

test('cerrar sesión invalida la sesión y el guard vuelve al login', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
