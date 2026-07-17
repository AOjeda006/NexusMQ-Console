import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Modal accesible sobre el primitivo **Radix Dialog**: atrapa el foco, cierra con
 * `Escape`, bloquea el scroll de fondo y cablea `aria-labelledby`/`describedby`.
 * El color sale de los tokens (`bg-elevated`, `border-border`); el contenido del
 * formulario lo pone el llamador.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-elevated p-6 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <RadixDialog.Title className="text-base font-semibold text-foreground">
                {title}
              </RadixDialog.Title>
              {description !== undefined && (
                <RadixDialog.Description className="text-sm text-muted-foreground">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Cerrar"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X aria-hidden className="size-4" />
            </RadixDialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
