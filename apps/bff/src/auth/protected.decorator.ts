import { SetMetadata } from '@nestjs/common';

/** Clave de metadata que marca una ruta como protegida por sesión de operador. */
export const PROTECTED_KEY = 'nexusmq:protected';

/**
 * Marca un controller (o handler) como **protegido**: el `SessionAuthGuard`
 * global exigirá sesión cuando el broker esté en modo con auth, e inyectará el
 * token confinado en el proxy. Las rutas sin este marcador son públicas.
 */
export const Protected = (): MethodDecorator & ClassDecorator => SetMetadata(PROTECTED_KEY, true);
