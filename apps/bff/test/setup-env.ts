// Entorno mínimo válido para los tests que arrancan la app Nest: la config es
// *fail-fast* (F1.2), así que sin estas variables el bootstrap abortaría. Solo
// se rellenan si no vienen ya del entorno real.
process.env['BROKER_ADMIN_URL'] ??= 'http://localhost:9644';
process.env['SESSION_SECRET'] ??= 'test-session-secret-0123456789-abcdef';
// El gate de login (F5.7) es `true` por defecto en producción; en los e2e del BFF
// se desactiva para aislar la mecánica de proxy/auth (modo abierto sin sesión).
// Los tests del gate lo activan explícitamente (CONSOLE_REQUIRE_LOGIN='true').
process.env['CONSOLE_REQUIRE_LOGIN'] ??= 'false';
