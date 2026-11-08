import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checks } from '@deficheckup/catalog';
import { protocolByCheck, protocolLogos } from '../src/lib/protocol-logos';
import type { LogoEntry } from '../src/lib/protocol-logos';

// A deliberately small, passive SVG subset. Reject rather than repair unfamiliar artwork.
const tags = new Set(['svg', 'g', 'path', 'defs', 'clipPath', 'linearGradient', 'stop']);
const attributes = new Set([
  'xmlns',
  'version',
  'width',
  'height',
  'viewBox',
  'preserveAspectRatio',
  'id',
  'data-name',
  'd',
  'fill',
  'stroke',
  'fill-rule',
  'clip-rule',
  'clip-path',
  'transform',
  'gradientUnits',
  'x1',
  'x2',
  'y1',
  'y2',
  'offset',
  'stop-color',
]);

/** Fail closed: no active elements, CSS, references, entities, namespaces or foreign content. */
export function verifySvg(svg: string) {
  const fail = () => {
    throw new Error('Unsafe or unsupported protocol SVG.');
  };
  if (
    /[&\\]|<!|<\?/.test(svg) ||
    [...svg].some((character) => character.charCodeAt(0) < 32 && !'\t\n\r'.includes(character))
  )
    fail();
  const stack: string[] = [];
  let position = 0;
  let roots = 0;
  while (position < svg.length) {
    const start = svg.indexOf('<', position);
    if (start === -1) {
      if (svg.slice(position).trim()) fail();
      break;
    }
    if (svg.slice(position, start).trim()) fail();
    const end = svg.indexOf('>', start);
    if (end === -1) fail();
    const token = svg.slice(start, end + 1).match(/^<(\/?)([A-Za-z][A-Za-z0-9]*)([\s\S]*?)(\/?)>$/);
    if (!token) fail();
    const [, closing, tag, body, selfClosing] = token!;
    if (!tags.has(tag!)) fail();
    if (closing) {
      if (body!.trim() || selfClosing || stack.pop() !== tag) fail();
    } else {
      if (stack.length === 0 && (tag !== 'svg' || ++roots !== 1)) fail();
      if (stack.length > 0 && tag === 'svg') fail();
      let remaining = body!;
      const seen = new Set<string>();
      while (remaining.trim()) {
        const attr = remaining.match(
          /^\s+([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/,
        );
        if (!attr) fail();
        const name = attr![1]!;
        const value = attr![2] ?? attr![3]!;
        if (!attributes.has(name) || seen.has(name)) fail();
        seen.add(name);
        if (name === 'xmlns' && value !== 'http://www.w3.org/2000/svg') fail();
        if (name !== 'xmlns' && /:|\/\//.test(value)) fail();
        if (
          /url\s*\(/i.test(value) &&
          !(['fill', 'clip-path'].includes(name) && /^url\(#[A-Za-z][A-Za-z0-9_-]*\)$/.test(value))
        )
          fail();
        remaining = remaining.slice(attr![0].length);
      }
      if (tag === 'svg' && !seen.has('xmlns')) fail();
      if (!selfClosing) stack.push(tag!);
    }
    position = end + 1;
  }
  if (roots !== 1 || stack.length) fail();
}

/** Run against both the source assets and the copied build output. Never fetch at build time. */
export function verifyLogos(directory: string) {
  const mapped = Object.keys(protocolByCheck).sort();
  if (JSON.stringify(mapped) !== JSON.stringify(checks.map(({ id }) => id).sort())) {
    throw new Error('Every catalog check needs an explicit protocol logo decision.');
  }
  const expected: string[] = [];
  for (const entry of Object.values(protocolLogos) as LogoEntry[]) {
    if (!/^https:\/\//.test(entry.sourcePage)) throw new Error('Logo source must use HTTPS.');
    // The union also supports an explicit missing entry with a reviewable reason.
    if (entry.kind === 'missing') {
      if (!entry.reason.trim()) throw new Error('Missing official logo needs a reason.');
      continue;
    }
    if (!/^\/logos\/[a-z]+\.(svg|png)$/.test(entry.file)) throw new Error('Invalid logo path.');
    if (
      !/^https:\/\//.test(entry.fileUrl) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.fetchedOn) ||
      !entry.terms
    ) {
      throw new Error('Incomplete logo provenance.');
    }
    const name = entry.file.slice('/logos/'.length);
    expected.push(name);
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 50_000)
      throw new Error('Invalid logo file.');
    const bytes = readFileSync(path);
    if (name.endsWith('.svg')) verifySvg(bytes.toString('utf8'));
    else if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error('Invalid PNG logo.');
    }
  }
  if (
    new Set(expected).size !== expected.length ||
    JSON.stringify(expected.sort()) !== JSON.stringify(readdirSync(directory).sort())
  ) {
    throw new Error('Logo files must match the manifest exactly.');
  }
}
