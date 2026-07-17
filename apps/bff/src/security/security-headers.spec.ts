import { describe, expect, it } from 'vitest';

import { buildCsp, inlineScriptHashes } from './security-headers';

describe('inlineScriptHashes', () => {
  it('hashea un script inline (el hash de cadena vacía es el conocido)', () => {
    expect(inlineScriptHashes('<script></script>')).toEqual([
      "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
    ]);
  });

  it('ignora los scripts con src (externos, ya cubiertos por script-src self)', () => {
    expect(inlineScriptHashes('<script src="/assets/app.js"></script>')).toEqual([]);
  });

  it('hashea solo los inline cuando se mezclan inline y externos', () => {
    const html =
      '<script>var a=1;</script><script src="/x.js"></script><script type="module">var b=2;</script>';
    expect(inlineScriptHashes(html)).toHaveLength(2);
  });
});

describe('buildCsp', () => {
  it('ancla todo al mismo origen y bloquea marcos/objetos', () => {
    const csp = buildCsp([]);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  it('añade los hashes inline a script-src', () => {
    const csp = buildCsp(["'sha256-abc'"]);
    expect(csp).toContain("script-src 'self' 'sha256-abc'");
  });
});
