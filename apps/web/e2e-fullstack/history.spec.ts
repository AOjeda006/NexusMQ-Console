import { expect, test, type Page } from '@playwright/test';

const SHOTS_DIR =
  'C:/Users/Predator/AppData/Local/Temp/claude/c--Users-Predator-Desktop-PROGRAMACION-PROYECTOS-Y-REPOS-NexusMQ-Console/ee8c41d0-eca4-4744-8475-bd8f764e1a1f/scratchpad';

const GOOD_TOKEN = 'good-operator-token';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Token de operador').fill(GOOD_TOKEN);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Sesión activa')).toBeVisible();
}

/**
 * E2E full-stack de **Historia** (F4.1). El BFF real proxya a un doble de
 * Prometheus (`query_range`): las gráficas de series temporales deben dibujarse
 * con datos reales, y el selector de ventana debe re-consultar.
 */
test('dibuja series temporales de throughput y latencias desde Prometheus vía BFF', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Historia' }).click();
  await expect(page).toHaveURL(/\/history$/);

  const history = page.getByTestId('history');

  // Las dos gráficas históricas se dibujan (uPlot en <canvas>, con leyenda).
  await expect(
    history.getByRole('img', { name: /Throughput histórico/ }),
  ).toBeVisible();
  await expect(
    history.getByRole('img', { name: /Latencias históricas/ }),
  ).toBeVisible();
  expect(await history.locator('canvas').count()).toBeGreaterThanOrEqual(2);

  // La leyenda de uPlot nombra las series (identidad, no solo color).
  await expect(history.getByText('Produce', { exact: true })).toBeVisible();
  await expect(history.getByText('p99', { exact: true })).toBeVisible();

  // Cambiar la ventana temporal re-consulta y mantiene las gráficas.
  await page.getByRole('radio', { name: '6 h' }).click();
  await expect(page.getByRole('radio', { name: '6 h' })).toHaveAttribute('aria-checked', 'true');
  await expect(history.locator('canvas').first()).toBeVisible();

  await page.screenshot({ path: `${SHOTS_DIR}/f41-history.png`, fullPage: true });
});

/**
 * Degradación limpia: si el BFF señaliza que Prometheus no está configurado, la
 * vista muestra un aviso honesto (sin romper el resto de la consola). Se fuerza
 * interceptando la respuesta de estado en el navegador.
 */
test('degrada con un aviso honesto cuando Prometheus no está configurado', async ({ page }) => {
  await page.route('**/api/history/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: false }),
    }),
  );

  await login(page);
  await page.getByRole('link', { name: 'Historia' }).click();
  await expect(page).toHaveURL(/\/history$/);

  const notice = page.getByTestId('history-degraded');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Historia no disponible');
  await expect(notice).toContainText('PROMETHEUS_URL');

  // No se pintan gráficas ni selector de rango en modo degradado.
  await expect(page.getByTestId('history-range')).toHaveCount(0);

  await page.screenshot({ path: `${SHOTS_DIR}/f41-history-degraded.png`, fullPage: true });
});
