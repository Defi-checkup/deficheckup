import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// This server models the assets-only Worker contract: drop-trailing-slash, no SPA fallback.
// Header merging and HTML redirects follow the pinned asset worker, not Astro preview.
export function parseHeaders(text) {
  if (/\{\{/.test(text)) throw new Error('Build the site before running browser tests.');
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const [path, ...lines] = block.split('\n');
      return {
        path,
        headers: lines.map((line) => {
          const colon = line.indexOf(':');
          return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
        }),
      };
    });
}

export function resolveRequest(requestUrl, files, rules) {
  const url = new URL(requestUrl, 'http://localhost');
  // Workers decodes each segment, then collapses repeated slashes and re-encodes redirects.
  const pathname = url.pathname
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/')
    .replace(/\/+/g, '/');
  const headers = new Headers();
  for (const rule of rules) {
    if (
      rule.path === url.pathname ||
      (rule.path.endsWith('/*') && url.pathname.startsWith(rule.path.slice(0, -1)))
    ) {
      for (const [name, value] of rule.headers) headers.append(name, value);
    }
  }
  const result = (status, file, location) => ({
    status,
    file,
    headers: {
      ...Object.fromEntries(headers),
      ...(location
        ? { location: location.split('/').map(encodeURIComponent).join('/') + url.search }
        : {}),
    },
  });
  if (pathname.split('/').some((part) => part === '..' || part === '.') || pathname.includes('\\'))
    return result(404);
  const exists = (path) =>
    path !== '/_headers' && path !== '/_redirects' && files.has(path.slice(1));
  const lookup = (path) => {
    const candidates =
      path === '/' ? ['/index.html'] : [path, `${path}.html`, `${path}/index.html`];
    return candidates.find(exists);
  };
  const redirect = (file, destination) =>
    !exists(destination) && exists(file) && lookup(destination) === file
      ? result(307, undefined, destination)
      : undefined;
  let redirected;
  if (pathname.endsWith('/index') && !exists(pathname)) {
    redirected =
      pathname === '/index'
        ? redirect('/index.html', '/')
        : (redirect(`${pathname.slice(0, -6)}.html`, pathname.slice(0, -6)) ??
          redirect(`${pathname}.html`, pathname.slice(0, -6)));
  } else if (pathname.endsWith('/index.html')) {
    redirected =
      pathname === '/index.html'
        ? redirect('/index.html', '/')
        : (redirect(pathname, pathname.slice(0, -11)) ??
          (!exists(pathname)
            ? redirect(`${pathname.slice(0, -11)}.html`, pathname.slice(0, -11))
            : undefined));
  } else if (pathname.endsWith('/') && pathname !== '/') {
    redirected =
      redirect(`${pathname.slice(0, -1)}.html`, pathname.slice(0, -1)) ??
      redirect(`${pathname}index.html`, pathname.slice(0, -1));
  } else if (pathname.endsWith('.html')) {
    redirected =
      redirect(pathname, pathname.slice(0, -5)) ??
      redirect(`${pathname.slice(0, -5)}/index.html`, pathname.slice(0, -5));
  }
  if (redirected) return redirected;
  const file = lookup(pathname);
  if (!file) return result(404);
  // Canonicalize encoded and repeated-slash spellings as the asset worker does.
  const canonical = pathname.split('/').map(encodeURIComponent).join('/');
  if (canonical !== url.pathname) return result(307, undefined, pathname);
  return result(200, file.slice(1));
}

export async function startServer(port = 4321) {
  const root = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  const rules = parseHeaders(await readFile(resolve(root, '_headers'), 'utf8'));
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = new Set(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => resolve(entry.parentPath, entry.name).slice(root.length)),
  );
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/vnd.microsoft.icon',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
  };
  const server = createServer(async (req, res) => {
    const response = resolveRequest(req.url, files, rules);
    if (response.status !== 200) {
      res.writeHead(response.status, response.headers);
      res.end();
      return;
    }
    try {
      const data = await readFile(resolve(root, response.file));
      res.writeHead(200, {
        ...response.headers,
        'Content-Type': types[extname(response.file)] ?? 'application/octet-stream',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404, response.headers);
      res.end();
    }
  });
  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', ready);
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await startServer();
}
