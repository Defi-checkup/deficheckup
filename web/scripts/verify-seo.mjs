import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Audit the actual prerendered artifacts. Runs after every build, without a browser or network.
const root = resolve(process.argv[2] ?? 'dist');
const environment = process.env.DEFICHECKUP_ENV ?? 'production';
assert(['staging', 'production'].includes(environment), 'Unknown build environment');
const staging = environment === 'staging';
const files = await readdir(root, { recursive: true });
const htmlFiles = files.filter((file) => file.endsWith('.html'));
assert(htmlFiles.includes('closing-soon/index.html'), 'Missing closing-soon page');
assert(htmlFiles.includes('support/index.html'), 'Missing support page');
const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
const headers = await readFile(resolve(root, '_headers'), 'utf8');
const robots = await readFile(resolve(root, 'robots.txt'), 'utf8');
if (staging) {
  assert.equal(robots, 'User-agent: *\nDisallow: /\n');
  assert.match(headers, /^\/\*\n {2}X-Robots-Tag: noindex, nofollow\n/m);
} else {
  assert(!/noindex|nofollow|X-Robots-Tag/i.test(headers), 'Production has indexing restrictions');
  assert.equal(robots, 'User-agent: *\nAllow: /\n\nSitemap: https://deficheckup.com/sitemap.xml\n');
}
const policies = new Map(
  headers
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const [path, ...lines] = block.split('\n');
      return [path, lines.join('\n')];
    }),
);
function policyFor(path) {
  const applied = [...policies].filter(
    ([pattern, value]) =>
      value.includes('Content-Security-Policy:') &&
      (pattern === path || (pattern.endsWith('/*') && path.startsWith(pattern.slice(0, -1)))),
  );
  assert.equal(applied.length, 1, `Missing or overlapping CSP: ${path}`);
  return applied[0][1];
}
const titles = new Set(),
  descriptions = new Set();
const visited = new Set();
// Independent expected set: an accidental missing manifest entry must fail the build audit too.
const illustrated = new Set([
  'zksync-lite',
  'uni-2020',
  'compound-v2',
  'cream',
  'aave-v2-rewards',
  'instadapp-dsa',
  'dsproxy',
  'hyperliquid',
  'solana-rent',
  'koi-lp',
]);
const heroes = new Set();
function decode(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
function attribute(html, attribute, value) {
  return decode(
    html.match(new RegExp(`<meta ${attribute}="${value}" content="([^"]+)"`))?.[1] ?? '',
  );
}
for (const file of htmlFiles) {
  const html = await readFile(resolve(root, file), 'utf8');
  assert.match(
    html,
    /<footer>[\s\S]*<a href="\/support">Support the project <svg class="heart"[^>]*aria-hidden="true"[\s\S]*?<\/svg><\/a>[\s\S]*<\/footer>/,
    `Missing support footer link: ${file}`,
  );
  const robotTags = [...html.matchAll(/<meta\b[^>]*\bname="robots"[^>]*>/gi)];
  const notices = [
    ...html.matchAll(/<p\b[^>]*\bdata-test-environment[^>]*>Test environment<\/p>/g),
  ];
  assert.equal(robotTags.length, staging ? 1 : 0, `Robots meta count: ${file}`);
  assert.equal(notices.length, staging ? 1 : 0, `Test notice count: ${file}`);
  if (staging) assert.match(robotTags[0][0], /content="noindex, nofollow"/);
  else assert(!/<meta\b[^>]*(?:noindex|nofollow)/i.test(html), `Production noindex: ${file}`);
  const path = `/${file.replace(/(?:^|\/)index\.html$|\.html$/, '')}`;
  const title = decode(html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '');
  const description = attribute(html, 'name', 'description');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert(title && description && canonical, `Missing metadata: ${file}`);
  assert(!titles.has(title) && !descriptions.has(description), `Duplicate metadata: ${file}`);
  titles.add(title);
  descriptions.add(description);
  assert.equal(canonical, `https://deficheckup.com${path}`);
  assert(sitemap.includes(`<loc>${canonical}</loc>`), `Missing sitemap URL: ${file}`);
  assert.equal(attribute(html, 'property', 'og:title'), title);
  assert.equal(attribute(html, 'property', 'og:description'), description);
  assert.equal(attribute(html, 'property', 'og:url'), canonical);
  assert.equal(attribute(html, 'name', 'twitter:title'), title);
  assert.equal(attribute(html, 'name', 'twitter:description'), description);
  assert.equal(attribute(html, 'name', 'twitter:card'), 'summary_large_image');
  const image = attribute(html, 'property', 'og:image');
  assert.equal(image, attribute(html, 'name', 'twitter:image'));
  assert(image.startsWith('https://deficheckup.com/social/'));
  const png = await readFile(resolve(root, image.replace('https://deficheckup.com/', '')));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  const aliases =
    file === 'index.html'
      ? ['/', '/index.html']
      : file.endsWith('/index.html')
        ? [path, `${path}/`, `/${file}`]
        : [path, `/${file}`];
  const policy = policyFor(path);
  for (const alias of aliases) assert.equal(policyFor(alias), policy, `CSP alias: ${alias}`);
  for (const tag of ['script', 'style']) {
    for (const match of html.matchAll(
      new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}\\s*>`, 'gi'),
    )) {
      // Only this unambiguous JSON-LD tag is exempt: it is data, not executable script.
      if (
        !match[2] ||
        (tag === 'script' && /^\s+type=(["'])application\/ld\+json\1\s*$/i.test(match[1]))
      )
        continue;
      const hash = `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`;
      const sources = policy.match(new RegExp(`;\\s*${tag}-src\\s+([^;]+)`))?.[1];
      assert(sources?.split(/\s+/).includes(hash), `Missing ${tag}-src hash: ${file}`);
    }
  }
  if (/^protocols\/[^/]+\/index\.html$/.test(file)) {
    const id = file.split('/')[1];
    visited.add(id);
    assert.equal(image, `https://deficheckup.com/social/${id}.png`, `Wrong social image: ${id}`);
    const heroTags = [...html.matchAll(/<img\b[^>]*class="[^"]*\bguide-hero\b[^"]*"[^>]*>/g)];
    assert.equal(heroTags.length, illustrated.has(id) ? 1 : 0, `Hero count: ${id}`);
    if (illustrated.has(id)) {
      heroes.add(id);
      const tag = heroTags[0][0];
      const attr = (name) => decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '');
      assert(attr('alt').trim(), `Missing hero alt: ${id}`);
      assert.equal(attr('width'), '1376', `Hero width: ${id}`);
      assert.equal(attr('height'), '768', `Hero height: ${id}`);
      assert.equal(attr('loading'), 'eager', `Hero loading: ${id}`);
      assert(attr('sizes'), `Missing hero sizes: ${id}`);
      const variants = attr('srcset')
        .split(',')
        .map((part) => part.trim().split(/\s+/));
      assert.deepEqual(
        variants.map(([, width]) => width),
        ['344w', '688w', '1032w', '1376w'],
      );
      for (const [src] of variants) {
        assert(
          src.startsWith('/_astro/') && src.endsWith('.webp'),
          `Hero must be local WebP: ${id}`,
        );
        const bytes = await readFile(resolve(root, src.slice(1)));
        assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
        assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      }
      assert(
        html.indexOf('</h1>') < html.indexOf('</p>', html.indexOf('</h1>')) &&
          html.indexOf('</p>', html.indexOf('</h1>')) < html.indexOf(tag),
        `Answer must precede hero: ${id}`,
      );
    }
    assert(
      title.length <= 60 && description.length >= 150 && description.length <= 160,
      `Metadata length: ${id}`,
    );
    const scripts = [
      ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ];
    assert.equal(scripts.length, 1, `JSON-LD count: ${id}`);
    const data = JSON.parse(scripts[0][1]);
    assert.equal(data['@context'], 'https://schema.org');
    assert.deepEqual(
      data['@graph'].map((node) => node['@type']),
      ['Article', 'BreadcrumbList'],
    );
    const [article, breadcrumb] = data['@graph'];
    const h1 = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '') ?? '');
    assert.equal(article.headline, h1);
    assert.equal(article.description, description);
    assert.equal(article.mainEntityOfPage, canonical);
    assert.equal(article.image[0], image);
    assert.equal(breadcrumb.itemListElement.at(-1).item, canonical);
    assert.equal(article.dateModified, html.match(/<time datetime="([^"]+)"/)?.[1]);
    assert(sitemap.includes(`<loc>${canonical}</loc><lastmod>${article.dateModified}</lastmod>`));
    assert(html.includes('id="faq"'), `Missing rendered FAQ: ${id}`);
  }
}
assert.deepEqual([...heroes].sort(), [...illustrated].sort(), 'Missing illustrated guide');
const catalog = await readdir(resolve('../catalog'), { withFileTypes: true });
for (const entry of catalog.filter(
  (entry) => entry.isDirectory() && !['example', 'shared', 'node_modules'].includes(entry.name),
)) {
  assert(visited.has(entry.name), `Guide missing from build: ${entry.name}`);
}
assert(!headers.includes('unsafe-inline') && !headers.includes('unsafe-eval'));
assert(headers.split('\n').every((line) => Buffer.byteLength(line) <= 2_000));
assert(policies.size <= 100, 'Workers static assets header rule budget exceeded');
const deadlinesHtml = await readFile(resolve(root, 'closing-soon/index.html'), 'utf8');
assert(deadlinesHtml.includes('<h1>Closing soon</h1>'));
assert(deadlinesHtml.includes('id="upcoming-deadlines"'));
assert(deadlinesHtml.includes('id="expired-deadlines"'));
for (const alias of ['/closing-soon', '/closing-soon/', '/closing-soon/index.html'])
  assert(policyFor(alias).includes('Content-Security-Policy:'), `Missing deadline CSP: ${alias}`);
for (const file of ['index.html', 'protocols/index.html']) {
  assert(
    (await readFile(resolve(root, file), 'utf8')).includes('href="/closing-soon"'),
    `Missing deadline link: ${file}`,
  );
}
console.log(
  `SEO audit (${environment}): ${htmlFiles.length} HTML pages, ${visited.size} guides, indexing, JSON-LD, sitemap, PNGs and CSP verified.`,
);
