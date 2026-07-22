/* Construye un PDF único de la documentación técnica de NexusMQ Console.
 *
 * Pipeline: Markdown (docs/tecnica/) -> HTML (markdown-it) -> Mermaid renderizado
 * en Chromium (headless, vía Playwright) -> PDF A4 con numeración de páginas.
 *
 * Uso:
 *   npm install
 *   node build.cjs            # genera NexusMQ-Console-documentacion-tecnica.pdf aquí
 *
 * Variables de entorno opcionales:
 *   PW_CHROMIUM_PATH=/ruta/al/chrome   # fuerza el binario de Chromium a usar
 *                                       # (si no, se usa el de Playwright).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const MarkdownIt = require('markdown-it');
const anchor = require('markdown-it-anchor');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '..', '..');
const DOCS = path.join(REPO, 'docs');
const OUT_PDF = path.join(__dirname, 'NexusMQ-Console-documentacion-tecnica.pdf');
const MERMAID_JS = fs.readFileSync(
  path.join(__dirname, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'), 'utf8');

// --- Orden del documento -------------------------------------------------
// Los capítulos van en su orden de lectura; los apéndices, al final. La consola
// no tiene catálogo de diagramas ni ADR como carpetas aparte: los diagramas son
// bloques Mermaid embebidos en el capítulo que los explica, y las decisiones
// as-built viven en el apéndice A.
const capitulos = [
  '00-prefacio', '01-resumen-ejecutivo', '02-contexto-y-motivacion', '03-glosario',
  '04-vista-de-conjunto', '05-principios-de-diseno', '06-arquitectura-frontend',
  '07-arquitectura-bff', '08-contrato-y-tipos-generados', '09-autenticacion-y-sesiones',
  '10-tiempo-real-sse', '11-observabilidad-y-metricas', '12-visualizacion', '13-seguridad',
  '14-modelo-de-errores', '15-estrategia-de-pruebas', '16-puerta-de-calidad-y-cicd',
  '17-despliegue', '18-configuracion-y-operacion', '19-limitaciones-y-trabajo-futuro',
].map(n => path.join(DOCS, 'tecnica', n + '.md'));

const apendices = ['98-registro-de-decisiones', '99-bibliografia']
  .map(n => path.join(DOCS, 'tecnica', n + '.md'));

// --- Markdown -> HTML, extrayendo los bloques mermaid --------------------
const md = new MarkdownIt({ html: true, linkify: true }).use(anchor, { tabIndex: false });
const mermaidDefs = [];
md.renderer.rules.fence = (tokens, idx) => {
  const t = tokens[idx];
  if ((t.info || '').trim() === 'mermaid') {
    const i = mermaidDefs.length;
    mermaidDefs.push(t.content);
    return `<div class="mermaid-slot" id="mslot-${i}" data-idx="${i}"></div>\n`;
  }
  return `<pre><code>${md.utils.escapeHtml(t.content)}</code></pre>\n`;
};

function titleOf(file, fallback) {
  const first = fs.readFileSync(file, 'utf8').split('\n').find(l => l.startsWith('# '));
  return first ? first.replace(/^#\s+/, '').trim() : fallback;
}
function section(file, cls) {
  const id = 'sec-' + path.basename(file, '.md');
  const html = md.render(fs.readFileSync(file, 'utf8'));
  return { id, title: titleOf(file, path.basename(file)), cls,
    html: `<section class="doc ${cls}" id="${id}">\n${html}\n</section>` };
}

const secs = [
  ...capitulos.map(f => section(f, 'cap')),
  ...apendices.map(f => section(f, 'apx')),
];

// --- Tabla de contenidos -------------------------------------------------
function tocGroup(label, list) {
  const items = list.map(s => `<li><a href="#${s.id}">${md.utils.escapeHtml(s.title)}</a></li>`).join('\n');
  return `<h2>${label}</h2>\n<ul class="toc">\n${items}\n</ul>`;
}
const toc = `<section class="doc toc-page" id="toc">
  <h1>Tabla de contenidos</h1>
  ${tocGroup('Documentación técnica', secs.filter(s => s.cls === 'cap'))}
  ${tocGroup('Apéndices', secs.filter(s => s.cls === 'apx'))}
</section>`;

const cover = `<section class="cover" id="cover">
  <div class="cover-inner">
    <div class="cover-kicker">Documentación técnica</div>
    <h1 class="cover-title">NexusMQ Console</h1>
    <div class="cover-sub">Consola web de administración y monitorización<br/>
      SPA React &middot; BFF NestJS</div>
    <div class="cover-meta">Andrés Ojeda Rodríguez &middot; 2026</div>
  </div>
</section>`;

const css = `
  :root { --fg:#1a1a1a; --muted:#555; --accent:#0b5cab; --code-bg:#f4f5f7; --border:#d6dae0; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
         color: var(--fg); font-size: 10.5pt; line-height: 1.5; margin: 0; }
  .cover { height: 247mm; display: flex; align-items: center; justify-content: center;
           text-align: center; page-break-after: always; }
  .cover-kicker { letter-spacing: .25em; text-transform: uppercase; color: var(--muted); font-size: 11pt; }
  .cover-title { font-size: 52pt; margin: 8pt 0 4pt; color: var(--accent); letter-spacing: -1px; }
  .cover-sub { font-size: 13pt; color: var(--fg); margin-top: 10pt; }
  .cover-meta { margin-top: 40pt; color: var(--muted); font-size: 10pt; }
  section.doc { page-break-before: always; }
  .toc-page ul.toc { list-style: none; padding-left: 0; columns: 2; column-gap: 24pt; }
  .toc-page ul.toc li { margin: 2pt 0; break-inside: avoid; font-size: 9.5pt; }
  .toc-page h2 { color: var(--accent); font-size: 12pt; margin: 14pt 0 6pt; column-span: all; }
  h1 { font-size: 19pt; color: var(--accent); border-bottom: 2px solid var(--border);
       padding-bottom: 4pt; margin: 0 0 10pt; }
  h2 { font-size: 14pt; margin: 16pt 0 6pt; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt; }
  a { color: var(--accent); text-decoration: none; }
  code { background: var(--code-bg); padding: 1px 4px; border-radius: 3px;
         font-family: 'SFMono-Regular',Consolas,'Liberation Mono',monospace; font-size: 9pt; }
  pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 5px;
        padding: 8pt 10pt; overflow-x: auto; page-break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 8.5pt; line-height: 1.4; }
  blockquote { border-left: 3px solid var(--accent); margin: 8pt 0; padding: 2pt 12pt;
               color: var(--muted); background: #fafbfc; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9pt; page-break-inside: avoid; }
  th, td { border: 1px solid var(--border); padding: 4pt 7pt; text-align: left; vertical-align: top; }
  th { background: var(--code-bg); }
  .mermaid-slot { text-align: center; margin: 10pt 0; page-break-inside: avoid; }
  .mermaid-slot svg { max-width: 100%; height: auto; }
  ul, ol { padding-left: 20pt; }
  li { margin: 1pt 0; }
`;

const pageHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>${css}</style></head><body>
${cover}
${toc}
${secs.map(s => s.html).join('\n')}
<script>${MERMAID_JS}</script>
<script>window.__DEFS__ = ${JSON.stringify(mermaidDefs)};</script>
</body></html>`;

const htmlPath = path.join(os.tmpdir(), 'nexusmq-console-doc-' + process.pid + '.html');
fs.writeFileSync(htmlPath, pageHtml);
console.log(`HTML: ${secs.length} secciones, ${mermaidDefs.length} diagramas mermaid`);

function findChromium() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  try {
    const dir = fs.readdirSync(base).find(x => /^chromium-\d+$/.test(x));
    if (dir) {
      const p = path.join(base, dir, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  } catch { /* sin navegador preinstalado: usa el de Playwright */ }
  return undefined;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: findChromium() });
  const pg = await browser.newPage();
  await pg.goto('file://' + htmlPath, { waitUntil: 'load', timeout: 120000 });
  const rendered = await pg.evaluate(async () => {
    /* global mermaid */
    mermaid.initialize({ startOnLoad: false, theme: 'neutral',
      flowchart: { useMaxWidth: true }, sequence: { useMaxWidth: true },
      themeVariables: { fontSize: '13px' } });
    const defs = window.__DEFS__; let ok = 0; const fails = [];
    for (let i = 0; i < defs.length; i++) {
      const slot = document.getElementById('mslot-' + i);
      try { const { svg } = await mermaid.render('mm' + i, defs[i]); slot.innerHTML = svg; ok++; }
      catch (e) {
        slot.innerHTML = '<pre>diagrama no renderizado</pre>';
        fails.push({ i, msg: String(e && e.message).split('\n')[0] });
      }
    }
    return { ok, fails };
  });
  console.log(`Mermaid renderizados: ${rendered.ok} ok, ${rendered.fails.length} fallidos`);
  for (const f of rendered.fails) console.log(`  [#${f.i}] ${f.msg}`);
  await pg.pdf({
    path: OUT_PDF, format: 'A4', printBackground: true,
    margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:8px;color:#888;width:100%;text-align:center;">'
      + 'NexusMQ Console — Documentación técnica · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  await browser.close();
  fs.unlinkSync(htmlPath);
  const kb = (fs.statSync(OUT_PDF).size / 1024).toFixed(0);
  console.log(`PDF escrito: ${OUT_PDF} (${kb} KB)`);
  if (rendered.fails.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
