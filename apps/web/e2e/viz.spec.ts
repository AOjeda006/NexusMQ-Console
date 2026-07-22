import { expect, test } from '@playwright/test';

/**
 * Verifica el arsenal de visualización (F2.3): el laboratorio `/lab` (fuera del
 * shell y del guard, sin llamadas a la API) renderiza una gráfica de cada
 * librería y respeta el tema. Cada wrapper expone `role="img"` con etiqueta;
 * ECharts, uPlot y react-three-fiber pintan sobre `<canvas>`, visx sobre `<svg>`.
 */
test('el laboratorio renderiza una gráfica de cada librería del arsenal', async ({ page }) => {
  await page.goto('/lab');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Laboratorio de visualización' }),
  ).toBeVisible();

  await expect(page.getByRole('img', { name: /ECharts/i })).toBeVisible();
  await expect(page.getByRole('img', { name: /uPlot/i })).toBeVisible();
  await expect(page.getByRole('img', { name: /visx/i })).toBeVisible();
  await expect(page.getByRole('img', { name: /topología del cluster/i })).toBeVisible();

  // ECharts + uPlot + react-three-fiber pintan sobre canvas (≥3).
  await expect.poll(() => page.locator('canvas').count()).toBeGreaterThanOrEqual(3);
  // visx dibuja paths SVG dentro de su figura.
  expect(await page.getByRole('img', { name: /visx/i }).locator('path').count()).toBeGreaterThan(0);
});

test('el laboratorio de visualización respeta el tema oscuro', async ({ page }) => {
  await page.goto('/lab');

  await page.getByLabel('Tema oscuro').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await expect(page.getByRole('img', { name: /ECharts/i })).toBeVisible();
  await expect.poll(() => page.locator('canvas').count()).toBeGreaterThanOrEqual(3);
});
