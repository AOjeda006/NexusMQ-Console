// Re-descarga el `openapi.yaml` de NexusMQ (fuente de verdad del contrato) desde
// el raw de GitHub y lo vendoriza en este paquete. Tras ejecutarlo, corre
// `pnpm --filter @nexusmq/contract generate` para regenerar los tipos.
//
// La URL se puede sobrescribir con la variable de entorno NEXUSMQ_OPENAPI_URL
// (por ejemplo para apuntar a un fork o a otra rama).

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_URL = 'https://raw.githubusercontent.com/AOjeda006/NexusMQ/main/docs/openapi.yaml';

const url = process.env.NEXUSMQ_OPENAPI_URL ?? DEFAULT_URL;
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '..', 'openapi.yaml');

const response = await fetch(url);
if (!response.ok) {
  console.error(
    `[sync:openapi] Fallo al descargar el OpenAPI: ${response.status} ${response.statusText} (${url})`,
  );
  process.exit(1);
}

const spec = await response.text();
await writeFile(target, spec, 'utf8');
console.log(`[sync:openapi] OpenAPI vendorizado desde ${url} → ${target} (${spec.length} bytes)`);
