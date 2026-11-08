import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { create } from 'fontkitten';
import type { Font } from 'fontkitten';
import sharp from 'sharp';
import { artForGuide } from './guide-art';

// Reuse approved Bricolage title, wordmark and secondary-heading faces as vector outlines.
// Outlines keep rendering independent of system fonts and SVG font-loading support.
// Astro builds run in the web workspace. Source files are read only during prerendering.
const assets = resolve('src/assets/fonts');
const faces = Promise.all(
  ['titles', 'wordmark', 'details'].map(async (face) => {
    const font = create(await readFile(resolve(assets, `bricolage-${face}.woff2`)));
    if (font.isCollection) throw new Error('Expected a single display face.');
    return font;
  }),
);
const css = readFile(resolve('src/styles/global.css'), 'utf8');

function textWidth(font: Font, text: string, size: number, tracking = 0) {
  return font
    .glyphsForString(text)
    .reduce((sum, glyph) => sum + (glyph.advanceWidth * size) / font.unitsPerEm + tracking, 0);
}

function textPaths(
  font: Font,
  text: string,
  size: number,
  x: number,
  y: number,
  fill: string,
  tracking = 0,
) {
  const scale = size / font.unitsPerEm;
  return font
    .glyphsForString(text)
    .map((glyph) => {
      const path = `<path fill="${fill}" transform="translate(${x} ${y}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
      x += glyph.advanceWidth * scale + tracking;
      return path;
    })
    .join('');
}

export async function socialImage(title: string, home = false, guideId?: string) {
  const [fonts, styles] = await Promise.all([faces, css]);
  const [display, wordmark, secondary] = fonts as [Font, Font, Font];
  function token(name: string) {
    const value = styles.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1];
    if (!value) throw new Error(`Missing design token ${name}.`);
    return value;
  }
  const bg = token('bg'),
    ink = token('ink'),
    panel = token('panel'),
    line = token('line');
  // A 600 x 315 logical canvas exported at 2x. Text, radii and spacing reuse the site tokens.
  const size = home ? 40 : 30;
  const art = guideId ? artForGuide(guideId) : undefined;
  // Split the existing card into equal columns, with 16px padding and a 28px gap.
  const columnWidth = (544 - 2 * 16 - 28) / 2;
  const maxWidth = home ? textWidth(display, '0'.repeat(14), size) : art ? columnWidth : 512;
  const lines: string[] = [];
  for (const word of title.split(' ')) {
    const last = lines.at(-1);
    const candidate = last ? `${last} ${word}` : word;
    if (last && textWidth(display, candidate, size, -0.02 * size) > maxWidth) lines.push(word);
    else if (last) lines[lines.length - 1] = candidate;
    else lines.push(word);
  }
  if (lines.length > 3) throw new Error(`Social title does not fit: ${title}`);
  const wordmarkSize = 24;
  const capHeight = (wordmark.capHeight * wordmarkSize) / wordmark.unitsPerEm;
  const logoSize = capHeight * 1.6;
  const logoY = 74 - capHeight / 2 - logoSize / 2;
  const wordmarkX = 28 + logoSize + logoSize * 0.18;
  const logo = (await readFile(resolve('public/favicon.svg'), 'utf8')).replace(
    '<svg ',
    `<svg x="28" y="${logoY}" width="${logoSize}" height="${logoSize}" `,
  );
  // Embed only the local optimized source. No network, font substitution or crop of the artwork.
  const illustration = art
    ? (await sharp(resolve('src/assets/guide-art', art.file)).png().toBuffer()).toString('base64')
    : undefined;
  const artHeight = (columnWidth * 768) / 1376;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 600 315">
    <defs><radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(300 -37.8) scale(1100 480)"><stop stop-color="${token('glow')}"/><stop offset="0.62" stop-color="${bg}"/></radialGradient>
    ${illustration ? `<clipPath id="art"><rect x="314" y="116" width="${columnWidth}" height="${artHeight}" rx="12"/></clipPath>` : ''}</defs>
    <rect width="600" height="315" fill="${bg}"/>
    <rect width="600" height="315" fill="url(#glow)"/>
    ${textPaths(secondary, 'No wallet connection. No signatures.', 22, 28, 28, ink)}
    ${logo}
    ${textPaths(wordmark, 'DeFi Checkup', wordmarkSize, wordmarkX, 74, ink)}
    <rect x="28" y="100" width="544" height="171" rx="12" fill="${panel}" stroke="${line}"/>
    ${lines.map((text, index) => textPaths(display, text, size, 44, 144 + index * size * 0.95, ink, -0.02 * size)).join('')}
    ${illustration ? `<image x="314" y="116" width="${columnWidth}" height="${artHeight}" href="data:image/png;base64,${illustration}" clip-path="url(#art)"/><rect x="314" y="116" width="${columnWidth}" height="${artHeight}" rx="12" fill="none" stroke="${line}"/>` : ''}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
