import type { ReactNode } from 'react';

import { AppearanceCard } from '@/features/settings/appearance-card';
import { ConnectionCard } from '@/features/settings/connection-card';
import { SessionCard } from '@/features/settings/session-card';

/**
 * Ajustes (F3.6): apariencia (tema), gestión de **sesión** (login/logout desde la
 * UI, con el estado de acceso real) e información de **conexión/observabilidad**.
 * El destino del broker se mantiene confinado en el servidor por seguridad (ver
 * `ConnectionCard`).
 */
export function SettingsPage(): ReactNode {
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Preferencias de la consola y estado de la conexión con el broker.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <AppearanceCard />
        <SessionCard />
        <ConnectionCard />
      </div>
    </section>
  );
}
