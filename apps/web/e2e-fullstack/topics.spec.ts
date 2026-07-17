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
 * E2E full-stack del CRUD de **Topics** (F3.2) contra la topología de producción
 * (BFF real + doble del broker con estado). Cubre el ciclo completo: crear →
 * describir → **editar retención (PATCH) con efecto real** → borrar. Nombre único
 * por ejecución para tolerar reintentos locales (el doble reutiliza estado).
 */
test('crea, describe, edita la retención (PATCH con efecto real) y borra un topic', async ({
  page,
}) => {
  const topicName = `e2e.demo.${Date.now()}`;
  await login(page);

  await page.getByRole('link', { name: 'Topics' }).click();
  await expect(page).toHaveURL(/\/topics$/);
  await expect(page.getByRole('cell', { name: 'orders.events', exact: true })).toBeVisible();

  // 1) Crear.
  await page.getByRole('button', { name: 'Crear topic' }).click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel('Nombre').fill(topicName);
  await createDialog.getByLabel('Particiones').fill('4');
  await createDialog.getByRole('button', { name: 'Crear topic' }).click();

  // Tras crear, el topic queda seleccionado: se abre su detalle.
  const detail = page.getByTestId('topic-detail');
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('heading', { level: 2, name: topicName })).toBeVisible();
  // …y aparece en la lista real (servida por el broker vía BFF).
  await expect(page.getByRole('button', { name: topicName, exact: true })).toBeVisible();

  // 2) Describir: 4 particiones y retención por defecto «Sin límite».
  await expect(detail.getByText('Particiones (4)')).toBeVisible();
  await expect(detail.getByText('p3', { exact: true })).toBeVisible();
  await expect(page.getByTestId('retention-ms')).toHaveText('Sin límite');
  await page.screenshot({ path: `${SHOTS_DIR}/f32-describe.png`, fullPage: true });

  // 3) PATCH de retención con **efecto real**: al aplicar, la descripción se vuelve
  //    a pedir al broker y el valor vigente cambia (no es optimista).
  await page.getByLabel('retentionMs').fill('3600000');
  await page.getByRole('button', { name: 'Aplicar retención' }).click();
  await expect(page.getByTestId('retention-applied')).toBeVisible();
  await expect(page.getByTestId('retention-ms')).toHaveText('1 h');
  await page.screenshot({ path: `${SHOTS_DIR}/f32-retention-applied.png`, fullPage: true });

  // La persistencia es real: al recargar (nueva descripción del broker) sigue en 1 h.
  await page.reload();
  await page.getByRole('button', { name: topicName, exact: true }).click();
  await expect(page.getByTestId('retention-ms')).toHaveText('1 h');

  // 4) Borrar: confirma y el topic desaparece de la lista real.
  await page.getByTestId('topic-detail').getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar topic' }).click();
  await expect(page.getByRole('button', { name: topicName, exact: true })).toHaveCount(0);
  await expect(page.getByTestId('topic-detail')).toHaveCount(0);
});
