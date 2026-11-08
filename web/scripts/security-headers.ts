import { createHash } from 'node:crypto';

// Non-HTML files get their own strict policy. Workers static assets joins matching CSP values,
// so a policy on /* would also restrict every page.
const STATIC_PATHS = [
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/robots.txt',
  '/sitemap.xml',
  '/social/*',
  '/logos/*',
  '/_astro/*',
];
const STATIC_POLICY =
  "  Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function matches(pattern: string, path: string) {
  return pattern === path || (pattern.endsWith('/*') && path.startsWith(pattern.slice(0, -1)));
}

/** Share identical catalog policies, without a union of hashes or reliance on host redirects. */
export function securityHeaders(
  template: string,
  documents: Map<string, string>,
  connections: readonly string[],
) {
  const lines = template.trimEnd().split('\n');
  const policy = lines.find((line) => line.startsWith('  Content-Security-Policy:'));
  if (!policy) throw new Error('Missing CSP template.');
  if (!documents.size) throw new Error('No HTML documents to protect.');
  const rules = [lines.filter((line) => line !== policy).join('\n')];
  const policies = new Map<string, string>();
  const aliases = new Map<string, string>();
  let catalogPolicy: string | undefined;
  for (const [file, html] of documents) {
    // Reject characters with special URL or header-pattern semantics.
    if (!/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.html$/.test(file)) {
      throw new Error(`Unsupported HTML path: ${file}`);
    }
    function hashes(tag: 'script' | 'style') {
      const values = [
        ...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}\\s*>`, 'gi')),
      ];
      return [
        ...new Set(
          values
            .filter(
              (match) =>
                match[2] &&
                // HTML prepare-the-script-element returns for data blocks before checking CSP.
                // Recognize only this unambiguous JSON-LD opening tag; hash all other forms.
                !(
                  tag === 'script' && /^\s+type=(["'])application\/ld\+json\1\s*$/i.test(match[1]!)
                ),
            )
            .map((match) => `'sha256-${createHash('sha256').update(match[2]!).digest('base64')}'`),
        ),
      ]
        .sort()
        .join(' ');
    }
    // Only the scanner loads Turnstile. These are Cloudflare's two documented CSP sources.
    // Keep all other pages and the entire connect/style/font policies unchanged.
    const pagePolicy =
      file === 'index.html'
        ? policy.replace(
            "script-src 'self'",
            "script-src 'self' https://challenges.cloudflare.com",
          ) + '; frame-src https://challenges.cloudflare.com'
        : policy;
    const csp = pagePolicy
      .replace('{{SCRIPT_HASHES}}', hashes('script'))
      .replace('{{STYLE_HASHES}}', hashes('style'))
      .replace('{{CONNECT_SOURCES}}', [...new Set(connections)].join(' '));
    const directory = file.replace(/index\.html$/, '');
    const paths =
      file === 'index.html'
        ? ['/', '/index.html']
        : file.endsWith('/index.html')
          ? [`/${directory.replace(/\/$/, '')}`, `/${directory}`, `/${file}`]
          : [`/${file.replace(/\.html$/, '')}`, `/${file}`];
    for (const path of paths) {
      if (aliases.has(path)) throw new Error(`Conflicting HTML alias: ${path}`);
      aliases.set(path, csp);
    }
    if (file.startsWith('protocols/')) {
      if (catalogPolicy !== undefined && catalogPolicy !== csp) {
        throw new Error(
          `Catalog CSP differs: ${file}. Keep shared policies identical, never union hashes.`,
        );
      }
      catalogPolicy = csp;
    } else {
      for (const path of paths) policies.set(path, csp);
    }
  }
  if (catalogPolicy !== undefined) {
    policies.set('/protocols', catalogPolicy);
    policies.set('/protocols/*', catalogPolicy);
  }
  for (const path of STATIC_PATHS) policies.set(path, STATIC_POLICY);
  for (const [path, expected] of aliases) {
    const applied = [...policies].filter(([pattern]) => matches(pattern, path));
    if (applied.length !== 1 || applied[0]![1] !== expected) {
      throw new Error(`Missing or overlapping CSP for HTML alias: ${path}`);
    }
  }
  for (const [path, csp] of policies) rules.push(`${path}\n${csp}`);
  const result = rules.join('\n\n') + '\n';
  if (
    rules.length > 100 ||
    result.includes('{{') ||
    result.split('\n').some((line) => Buffer.byteLength(line) > 2_000)
  ) {
    throw new Error(
      'Generated security headers exceed Workers static assets limits or contain placeholders.',
    );
  }
  return result;
}
