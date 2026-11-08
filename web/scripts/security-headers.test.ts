import { createHash } from 'node:crypto';
import { checks } from '@deficheckup/catalog';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { securityHeaders } from './security-headers';

const template = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const digest = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const jsonLd = (id: string) =>
  `<script type="application/ld+json">${JSON.stringify({ '@type': 'Article', headline: id })}</script>`;
const currentDocuments = () =>
  new Map([
    ['index.html', '<script>hydrate()</script><style>island{display:contents}</style>'],
    ['protocols/index.html', ''],
    ['privacy/index.html', ''],
    ['closing-soon/index.html', ''],
    ['support/index.html', '<script>copy()</script><style>island{display:contents}</style>'],
    ...checks.map(
      (check) => [`protocols/${check.id}/index.html`, jsonLd(check.id)] as [string, string],
    ),
  ]);
function blocks(headers: string) {
  return headers
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const [path, ...lines] = block.split('\n');
      return { path: path!, value: lines.join('\n') };
    });
}
function policyAt(headers: string, path: string) {
  const applied = blocks(headers).filter(
    (rule) =>
      rule.value.includes('Content-Security-Policy:') &&
      (rule.path === path || (rule.path.endsWith('/*') && path.startsWith(rule.path.slice(0, -1)))),
  );
  // Workers static assets stacks all matching rules. Exactly one CSP must match, even on redirect aliases.
  expect(applied, path).toHaveLength(1);
  return applied[0]!.value;
}

function assertRoutes(headers: string, documents: Map<string, string>) {
  for (const file of documents.keys()) {
    const aliases =
      file === 'index.html'
        ? ['/', '/index.html']
        : [
            `/${file.replace(/\/index\.html$/, '')}`,
            `/${file.replace(/index\.html$/, '')}`,
            `/${file}`,
          ];
    for (const alias of aliases) {
      const policy = policyAt(headers, alias);
      expect(policy).toContain("default-src 'none'");
      expect(policy.match(/script-src ([^;]+);/)?.[1]?.trim()).toBe(
        file === 'index.html'
          ? `'self' https://challenges.cloudflare.com ${digest('hydrate()')}`
          : file === 'support/index.html'
            ? `'self' ${digest('copy()')}`
            : "'self'",
      );
      expect(policy.match(/style-src ([^;]+);/)?.[1]?.trim()).toBe(
        file === 'index.html' || file === 'support/index.html'
          ? `'self' ${digest('island{display:contents}')}`
          : "'self'",
      );
    }
  }
  expect(headers).not.toMatch(/unsafe-inline|unsafe-eval|\{\{/);
}

describe('generated HTML security headers', () => {
  it('allows only the documented Turnstile script and frame sources, only on the scanner', () => {
    const documents = currentDocuments();
    const headers = securityHeaders(template, documents, ['https://rpc.example']);
    const home = policyAt(headers, '/');
    expect(home).toContain('frame-src https://challenges.cloudflare.com');
    expect(home.match(/connect-src ([^;]+);/)?.[1]).toBe("'self' https://rpc.example");
    expect(home.match(/style-src ([^;]+);/)?.[1]).toBe(
      `'self' ${digest('island{display:contents}')}`,
    );
    for (const path of ['/privacy', '/protocols', '/closing-soon', '/support', '/_astro/app.js'])
      expect(policyAt(headers, path)).not.toContain('challenges.cloudflare.com');
  });
  it('protects every current route and all aliases with 22 rules, leaving 78 rules free', () => {
    const documents = currentDocuments();
    expect(documents.size).toBe(32);
    const headers = securityHeaders(template, documents, ['https://rpc.example']);
    expect(blocks(headers)).toHaveLength(22);
    assertRoutes(headers, documents);
    expect(headers).toContain('https://rpc.example');
    expect(policyAt(headers, '/protocols')).toBe(policyAt(headers, '/protocols/lido-withdrawals'));
    expect(policyAt(headers, '/protocols/liquity-surplus')).not.toContain(digest('hydrate()'));
  });

  it('fits at least 100 extra guides with unique JSON-LD without adding rules or hashes', () => {
    const documents = currentDocuments();
    const before = securityHeaders(template, documents, []);
    for (let i = 0; i < 100; i++)
      documents.set(`protocols/future-${i}/index.html`, jsonLd(`Future ${i}`));
    const after = securityHeaders(template, documents, []);
    expect(documents.size).toBe(132);
    expect(after).toBe(before);
    expect(blocks(after)).toHaveLength(22);
    assertRoutes(after, documents);
    // 1 common + 8 static + 2 home + 3 privacy + 3 closing-soon + 3 support + 2 catalog = 22.
    // Turnstile changes the two home policies without adding rules.
    // Additional catalog pages cost zero rules. Other directory pages cost three each.
  });

  it('omits inert JSON-LD hashes while preserving exact executable script and style bytes', () => {
    const json = JSON.stringify({ '@type': 'Article', headline: 'A < B' });
    const scripts = [' hydrate(1)\n', 'module()', '{"imports":{}}', '{"prefetch":[]}'];
    const html =
      `<script>${scripts[0]}</script><script type="module">${scripts[1]}</script>` +
      `<script type="importmap">${scripts[2]}</script><script type="speculationrules">${scripts[3]}</script>` +
      `<script type="application/ld+json">${json}</script><style> a { color: red }\n</style>`;
    const headers = securityHeaders(template, new Map([['index.html', html]]), []);
    for (const alias of ['/', '/index.html']) {
      const policy = policyAt(headers, alias);
      for (const script of scripts) expect(policy).toContain(digest(script));
      expect(policy).toContain(digest(' a { color: red }\n'));
      expect(policy).not.toContain(digest(json));
    }
  });

  it('only exempts unambiguous JSON-LD tags, never lookalike or duplicate type attributes', () => {
    const attributes = [
      'data-type="application/ld+json"',
      'title=\'type="application/ld+json"\'',
      'type="text/javascript" type="application/ld+json"',
      'type=""',
      'type="text/javascript"',
      'type="module"',
    ];
    for (const attribute of attributes) {
      const headers = securityHeaders(
        template,
        new Map([['index.html', `<script ${attribute}>run()</script>`]]),
        [],
      );
      expect(policyAt(headers, '/')).toContain(digest('run()'));
    }
    const headers = securityHeaders(
      template,
      new Map([['index.html', "<SCRIPT TYPE='application/ld+json'>{}</SCRIPT>"]]),
      [],
    );
    expect(policyAt(headers, '/')).not.toContain(digest('{}'));
  });

  it('never unions distinct catalog hashes, regardless of document order', () => {
    for (const inline of ['<script>guide()</script>', '<style>p{color:red}</style>']) {
      const entries: [string, string][] = [
        ['protocols/index.html', ''],
        ['protocols/test/index.html', inline],
      ];
      for (const ordered of [entries, [...entries].reverse()]) {
        expect(() => securityHeaders(template, new Map(ordered), [])).toThrow(
          'Catalog CSP differs',
        );
      }
    }
  });

  it('can share exact hashes when every catalog document needs the same inline code', () => {
    const html = '<script>shared()</script><style>p{color:red}</style>';
    const documents = new Map([
      ['protocols/index.html', html],
      ['protocols/test/index.html', html + jsonLd('test')],
    ]);
    const headers = securityHeaders(template, documents, []);
    for (const alias of [
      '/protocols',
      '/protocols/',
      '/protocols/index.html',
      '/protocols/test',
      '/protocols/test/',
      '/protocols/test/index.html',
    ]) {
      expect(policyAt(headers, alias)).toContain(digest('shared()'));
      expect(policyAt(headers, alias)).toContain(digest('p{color:red}'));
    }
  });

  it('keeps all eight static policies and the common headers unchanged', () => {
    const headers = securityHeaders(template, currentDocuments(), []);
    for (const path of [
      '/favicon.svg',
      '/favicon.ico',
      '/apple-touch-icon.png',
      '/robots.txt',
      '/sitemap.xml',
      '/social/home.png',
      '/logos/lido.png',
      '/_astro/app.js',
    ]) {
      expect(policyAt(headers, path)).toBe(
        "  Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      );
    }
    const common = blocks(headers)[0]!;
    expect(common.path).toBe('/*');
    expect(common.value).toBe(template.trimEnd().split('\n').slice(2).join('\n'));
  });

  it('automatically protects other new routes and flat HTML without sharing their hashes', () => {
    const documents = currentDocuments();
    documents.set('new-page/index.html', '<script>newPage()</script>');
    documents.set('flat.html', '<script>flatPage()</script>');
    const headers = securityHeaders(template, documents, []);
    for (const alias of ['/new-page', '/new-page/', '/new-page/index.html']) {
      expect(policyAt(headers, alias)).toContain(digest('newPage()'));
      expect(policyAt(headers, alias)).not.toContain(digest('hydrate()'));
    }
    for (const alias of ['/flat', '/flat.html'])
      expect(policyAt(headers, alias)).toContain(digest('flatPage()'));
    expect(policyAt(headers, '/')).not.toContain(digest('newPage()'));
    expect(policyAt(headers, '/closing-soon')).not.toContain(digest('newPage()'));
  });

  it('rejects host limits, including exactly the first rule beyond the 100-rule budget', () => {
    const documents = currentDocuments();
    for (let i = 0; i < 24; i++) documents.set(`extra-${i}/index.html`, '');
    documents.set('flat-one.html', '');
    documents.set('flat-two.html', '');
    documents.set('flat-three.html', '');
    expect(blocks(securityHeaders(template, documents, []))).toHaveLength(100);
    documents.set('flat-four.html', '');
    expect(() => securityHeaders(template, documents, [])).toThrow('Workers static assets limits');
    expect(() => securityHeaders(template, currentDocuments(), ['x'.repeat(2_000)])).toThrow(
      'Workers static assets limits',
    );
    // The existing byte limit is conservative for Cloudflare's documented character limit.
    expect(() => securityHeaders(template, currentDocuments(), ['é'.repeat(1_000)])).toThrow(
      'Workers static assets limits',
    );
    expect(() => securityHeaders(template, currentDocuments(), ['{{UNRESOLVED}}'])).toThrow(
      'placeholders',
    );
  });

  it('fails rather than leave HTML unprotected or under overlapping static policies', () => {
    expect(() => securityHeaders('', currentDocuments(), [])).toThrow('Missing CSP template');
    expect(() => securityHeaders(template, new Map(), [])).toThrow('No HTML documents');
    for (const file of [
      'social/unexpected/index.html',
      'logos/unexpected.html',
      '_astro/unexpected.html',
    ]) {
      const documents = currentDocuments();
      documents.set(file, '');
      expect(() => securityHeaders(template, documents, [])).toThrow('overlapping CSP');
    }
    for (const file of [
      '/index.html',
      '../index.html',
      'protocols/*/index.html',
      'x:y/index.html',
    ]) {
      expect(() => securityHeaders(template, new Map([[file, '']]), [])).toThrow(
        'Unsupported HTML path',
      );
    }
    expect(() =>
      securityHeaders(
        template,
        new Map([
          ['privacy.html', ''],
          ['privacy/index.html', ''],
        ]),
        [],
      ),
    ).toThrow('Conflicting HTML alias');
  });
});
