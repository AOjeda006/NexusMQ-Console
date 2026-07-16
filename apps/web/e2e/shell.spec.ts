import { expect, type Page, test } from '@playwright/test';

const SHOTS_DIR =
  'C:/Users/Predator/AppData/Local/Temp/claude/c--Users-Predator-Desktop-PROGRAMACION-PROYECTOS-Y-REPOS-NexusMQ-Console/ee8c41d0-eca4-4744-8475-bd8f764e1a1f/scratchpad';

/**
 * Estos tests verifican solo el **shell** (F2.1) sobre el build estático servido
 * por `vite preview`, sin BFF. Como el shell va tras el guard de auth (F2.2),
 * simulamos una sesión activa interceptando `GET /api/auth/session`; así el
 * `useAccess` resuelve a «authenticated» y el shell se monta. El camino real de
 * datos/auth se cubre full-stack en `e2e-fullstack/data.spec.ts`.
 */
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true }),
    }),
  );
  await page.route('**/api/v1/topics*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ page: 1, size: 20, items: [] }),
    }),
  );
});

/** Luminancia relativa WCAG de un color `#rgb` o `#rrggbb`. */
function luminance(hex: string): number {
  const raw = hex.trim().replace('#', '');
  // El navegador serializa `#ffffff` como `#fff`; expandimos la forma corta.
  const value =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Ratio de contraste WCAG entre dos colores `#rrggbb`. */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Lee un token CSS (hex) resuelto en el `:root` bajo el tema actual. */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim(),
    name,
  );
}

test('renderiza el shell con marca, navegación y título de sección', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'NexusMQ Console — inicio' })).toBeVisible();
  for (const label of ['Dashboard', 'Topics', 'Grupos', 'Cluster', 'Historia', 'Ajustes']) {
    await expect(page.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  await page.screenshot({ path: `${SHOTS_DIR}/f21-dashboard-light.png`, fullPage: true });
});

test('navega entre secciones y marca la activa', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Topics' }).click();
  await expect(page).toHaveURL(/\/topics$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Topics' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Topics' })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('link', { name: 'Cluster' }).click();
  await expect(page).toHaveURL(/\/cluster$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cluster' })).toBeVisible();
});

test('conmuta a oscuro, persiste al recargar y vuelve a claro', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.dataset['theme'])).toBeUndefined();

  await page.getByLabel('Tema oscuro').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // El script anti-FOUC de index.html debe reaplicar el tema antes del paint.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: `${SHOTS_DIR}/f21-dashboard-dark.png`, fullPage: true });

  await page.getByLabel('Tema claro').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('contraste AA del texto sobre superficie y página en ambos temas', async ({ page }) => {
  await page.goto('/');

  for (const theme of ['light', 'dark'] as const) {
    await page.getByLabel(theme === 'light' ? 'Tema claro' : 'Tema oscuro').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    const [foreground, muted, page_, surface] = await Promise.all([
      token(page, '--foreground'),
      token(page, '--muted-foreground'),
      token(page, '--page'),
      token(page, '--surface'),
    ]);

    // Texto primario y secundario deben cumplir AA (>=4.5) sobre ambos planos.
    expect(contrast(foreground, page_), `foreground/page (${theme})`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(foreground, surface), `foreground/surface (${theme})`).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(muted, page_), `muted/page (${theme})`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, surface), `muted/surface (${theme})`).toBeGreaterThanOrEqual(4.5);
  }
});

test('ruta desconocida muestra la vista 404 dentro del shell', async ({ page }) => {
  await page.goto('/ruta-que-no-existe');

  await expect(page.getByRole('heading', { level: 2, name: 'Página no encontrada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver al Dashboard' })).toBeVisible();
  // El shell sigue presente (no es una página suelta).
  await expect(page.getByRole('link', { name: 'NexusMQ Console — inicio' })).toBeVisible();
});
