import { expect, test, type Page } from '@playwright/test';

const SHOTS_DIR =
  'C:/Users/Predator/AppData/Local/Temp/claude/c--Users-Predator-Desktop-PROGRAMACION-PROYECTOS-Y-REPOS-NexusMQ-Console/ee8c41d0-eca4-4744-8475-bd8f764e1a1f/scratchpad';

const GOOD_TOKEN = 'good-operator-token';

/** Inicia sesión (el fallback a polling del snapshot exige sesión desde F5.7). */
async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Token de operador').fill(GOOD_TOKEN);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Sesión activa')).toBeVisible();
}

/**
 * E2E full-stack del tiempo real (F2.4): `/live-lab` usa `useLiveStream` contra
 * el **SSE real del BFF** (que reemite los frames del doble del broker) y su
 * fallback a polling del snapshot. El SSE es abierto; el snapshot del fallback
 * exige sesión (gate de login F5.7), así que primero se inicia sesión.
 */
test('recibe push por SSE y cae a polling al fallar el SSE, sin romper la UI', async ({ page }) => {
  await login(page);
  await page.goto('/live-lab');

  const panel = page.getByTestId('live-panel');

  // 1) SSE en vivo: el BFF reemite los frames del doble del broker.
  await expect(panel).toHaveAttribute('data-status', 'live');
  await expect(panel).toHaveAttribute('data-source', 'sse');

  // Llega push en vivo: la marca de última actualización avanza sola.
  const firstUpdated = await panel.getAttribute('data-updated');
  await expect.poll(() => panel.getAttribute('data-updated')).not.toBe(firstUpdated);
  await page.screenshot({ path: `${SHOTS_DIR}/f24-live.png`, fullPage: true });

  // 2) Forzar el fallo del SSE ⇒ cae a polling del snapshot.
  await page.getByRole('button', { name: 'Forzar fallo de SSE' }).click();
  await expect(panel).toHaveAttribute('data-status', 'polling');
  await expect(panel).toHaveAttribute('data-source', 'polling');

  // El polling sigue actualizando (snapshot creciente): la UI no se rompe.
  const polledUpdated = await panel.getAttribute('data-updated');
  await expect.poll(() => panel.getAttribute('data-updated')).not.toBe(polledUpdated);
  await page.screenshot({ path: `${SHOTS_DIR}/f24-polling.png`, fullPage: true });

  // 3) Restaurar el SSE ⇒ vuelve a estar en vivo.
  await page.getByRole('button', { name: 'Restaurar SSE' }).click();
  await expect(panel).toHaveAttribute('data-status', 'live');
  await expect(panel).toHaveAttribute('data-source', 'sse');
});
