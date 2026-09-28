// Regenerates src/scripts/hero/font.typeface.json, the three.js typeface used by
// the 3D letters in the hero (Space Grotesk Bold, SIL Open Font License 1.1).
// Only the glyphs the hero can render are kept, so the file stays small.
// Usage: node scripts/build-hero-font.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const source = new URL(
  '../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff',
  import.meta.url,
);
const target = new URL('../src/scripts/hero/font.typeface.json', import.meta.url);

const buf = readFileSync(source);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
// Same conversion as three/examples/jsm/loaders/TTFLoader.js
const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
const r = Math.round;
const glyphs = {};
for (const ch of GLYPHS) {
  const g = font.charToGlyph(ch);
  let o = '';
  for (const c of g.path.commands) {
    const type = c.type.toLowerCase() === 'c' ? 'b' : c.type.toLowerCase();
    o += type + ' ';
    if (c.x !== undefined) o += `${r(c.x * scale)} ${r(c.y * scale)} `;
    if (c.x1 !== undefined) o += `${r(c.x1 * scale)} ${r(c.y1 * scale)} `;
    if (c.x2 !== undefined) o += `${r(c.x2 * scale)} ${r(c.y2 * scale)} `;
  }
  glyphs[ch] = { ha: r(g.advanceWidth * scale), x_min: r((g.xMin ?? 0) * scale), x_max: r((g.xMax ?? 0) * scale), o };
}
const out = JSON.stringify({
  glyphs,
  familyName: font.getEnglishName('fullName'),
  ascender: r(font.ascender * scale),
  descender: r(font.descender * scale),
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: {
    xMin: font.tables.head.xMin,
    xMax: font.tables.head.xMax,
    yMin: font.tables.head.yMin,
    yMax: font.tables.head.yMax,
  },
  resolution: 1000,
  license: 'SIL Open Font License 1.1 — Copyright 2020 The Space Grotesk Project Authors',
});
writeFileSync(target, out);
console.log(`wrote ${Object.keys(glyphs).length} glyphs from "${font.getEnglishName('fullName')}" (${(out.length / 1024).toFixed(1)} KB)`);
