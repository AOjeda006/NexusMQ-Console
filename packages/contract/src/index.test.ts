import { describe, expect, it } from 'vitest';

import { createNexusMqClient } from './index.js';

describe('@nexusmq/contract', () => {
  it('crea un cliente tipado con los métodos de openapi-fetch', () => {
    const client = createNexusMqClient({ baseUrl: 'http://localhost' });

    expect(typeof client.GET).toBe('function');
    expect(typeof client.POST).toBe('function');
    expect(typeof client.DELETE).toBe('function');
    expect(typeof client.PATCH).toBe('function');
  });
});
