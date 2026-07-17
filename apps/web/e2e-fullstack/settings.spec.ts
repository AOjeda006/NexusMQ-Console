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
 * E2E full-stack de **Ajustes** (F3.6): apariencia (tema), gestión de sesión
 * (estado + logout desde la UI) e información de conexión/observabilidad.
 */
test('permite cambiar de tema, ver el estado de conexión y cerrar sesión desde la UI', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page).toHaveURL(/\/settings$/);

  // Apariencia: cambiar a oscuro aplica data-theme al documento.
  await page.getByRole('radio', { name: 'Oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Sesión: estado real + acción de cerrar sesión.
  const session = page.getByTestId('session-card');
  await expect(session).toContainText('Sesión activa');

  // Conexión/observabilidad: broker confinado y Prometheus configurada en el e2e (F4.1).
  await expect(page.getByText('Confinado en el servidor (BFF)')).toBeVisible();
  await expect(page.getByText('Disponible')).toBeVisible();
  await page.screenshot({ path: `${SHOTS_DIR}/f36-settings.png`, fullPage: true });

  // Logout desde la UI ⇒ el guard vuelve al login.
  await page.getByTestId('settings-logout').click();
  await expect(page).toHaveURL(/\/login$/);
});
