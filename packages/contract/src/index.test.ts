import { describe, expect, it } from 'vitest';

import { contractPackageName } from './index.js';

describe('@nexusmq/contract', () => {
  it('expone el nombre del paquete', () => {
    expect(contractPackageName).toBe('@nexusmq/contract');
  });
});
