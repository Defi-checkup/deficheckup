import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Run from any directory after a production build. Sizes exclude HTTP headers and Brotli.
const root = new URL('../web/dist/', import.meta.url);
const files = await readdir(new URL('_astro/', root));
const assets = new Map(
  await Promise.all(
    files.map(async (name) => [name, await readFile(new URL(`_astro/${name}`, root))]),
  ),
);
const html = await readFile(new URL('index.html', root), 'utf8');
const initial = new Set();
function visit(name) {
  if (initial.has(name)) return;
  const bytes = assets.get(name);
  if (!bytes) throw new Error(`Missing client module: ${name}`);
  initial.add(name);
  // Vite emits relative static imports. Dynamic imports are counted only in the full output.
  for (const match of bytes
    .toString()
    .matchAll(/\b(?:import|export)\s*(?:[^;"'()]*?\bfrom\s*)?["']\.\/([^"']+\.js)["']/g))
    visit(match[1]);
}
for (const match of html.matchAll(/(?:component-url|renderer-url|src)="\/_astro\/([^"']+\.js)"/g)) {
  visit(match[1]);
}
if (!initial.size) throw new Error('No initial client entry points found.');
const css = files.filter((name) => name.endsWith('.css'));
const initialCss = [...html.matchAll(/<link\b[^>]*>/g)]
  .map(([tag]) =>
    /\brel="stylesheet"/.test(tag) ? tag.match(/\bhref="\/_astro\/([^"]+\.css)"/)?.[1] : undefined,
  )
  .filter(Boolean);
const js = files.filter((name) => name.endsWith('.js'));
for (const name of js) {
  const code = assets.get(name).toString();
  if (
    /["'`]node:|worker_threads|__vite-browser-external|virtualMasterPool|new (?:Shared)?Worker\(/.test(
      code,
    )
  ) {
    throw new Error(`Node or worker runtime leaked into browser output: ${name}`);
  }
}
if (
  [...initial].some((name) =>
    /^(?:scan|ScanViews|ScanProgress|Report|NetworkBoard|TokenCoin|report)\./.test(name),
  )
) {
  throw new Error('Scan or report code is eagerly imported by the idle form.');
}
if (initialCss.some((name) => /^(?:ScanViews|scan)\./.test(name))) {
  throw new Error('Scan and report styles are eagerly loaded by the idle home.');
}
function size(names) {
  return {
    files: names.length,
    bytes: names.reduce((sum, name) => sum + assets.get(name).length, 0),
    gzipBytes: names.reduce((sum, name) => sum + gzipSync(assets.get(name)).length, 0),
  };
}
function breakdown(names) {
  return names.map((name) => ({
    name,
    bytes: assets.get(name).length,
    gzipBytes: gzipSync(assets.get(name)).length,
  }));
}
console.log(
  JSON.stringify(
    {
      directory: fileURLToPath(root),
      initialJavaScript: size([...initial]),
      allJavaScript: size(js),
      css: size(css),
      initialCss: size(initialCss),
      fonts: size(files.filter((name) => name.endsWith('.woff2'))),
      homeHtml: { bytes: Buffer.byteLength(html), gzipBytes: gzipSync(html).length },
      initialModules: [...initial],
      initialModuleSizes: breakdown([...initial]),
      stylesheets: breakdown(css),
      initialStylesheets: initialCss,
      browserRuntimeAudit:
        'No Node imports, browser external stubs or worker runtime in any emitted JavaScript.',
    },
    null,
    2,
  ),
);
