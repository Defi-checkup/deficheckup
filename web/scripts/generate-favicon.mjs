import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Regenerate from the repository root: node web/scripts/generate-favicon.mjs
// Render the public SVG directly, preserving the approved artwork and viewBox.
const source = await readFile(new URL('../public/favicon.svg', import.meta.url));
const sizes = [16, 32];
const images = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
);

// ICO directory followed by two PNG payloads, each rendered directly from the SVG.
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2); // Icon file type.
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = size;
  directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4); // Color planes.
  directory.writeUInt16LE(32, entry + 6); // RGBA bits per pixel.
  directory.writeUInt32LE(images[index].length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
await writeFile(
  new URL('../public/favicon.ico', import.meta.url),
  Buffer.concat([directory, ...images]),
);
