/*
 * Keep approved StudyLab brand assets intact.
 * All raster icons were uploaded by the owner; never generate or overwrite PNG files.
 * Only validate icons and refresh HTML icon/manifest URLs at build time.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const version = 'sl-approved-20261117';
const iconDir = join(root, 'assets', 'icon');

for (const [name, size] of [
  ['studylab-192.png', 192],
  ['studylab-512.png', 512],
  ['studylab-180.png', 180],
  ['studylab-maskable-512.png', 512],
  ['studylab-32.png', 32]
]) {
  const path = join(iconDir, name);
  if (!existsSync(path)) throw new Error('Missing approved StudyLab icon: ' + name);
  const png = readFileSync(path);
  if (png.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' ||
      png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
    throw new Error('Invalid approved StudyLab icon dimensions or PNG format: ' + name);
  }
}
for (const name of ['studylab-pwa.svg', 'studylab-favicon.svg']) {
  if (!existsSync(join(iconDir, name))) throw new Error('Missing approved StudyLab icon: ' + name);
}

let updated = 0;
for (const page of readdirSync(root).filter(name => name.endsWith('.html'))) {
  const path = join(root, page);
  const original = readFileSync(path, 'utf8');
  const next = original
    .replace(/href="\/assets\/icon\/(?:studylab-pwa|studylab-favicon)\.svg(?:\?[^"]*)?"/g,
      'href="/assets/icon/studylab-favicon.svg?v=' + version + '"')
    .replace(/href="\/assets\/icon\/(?:icon2|studylab-180)\.png(?:\?[^"]*)?"/g,
      'href="/assets/icon/studylab-180.png?v=' + version + '"')
    .replace(/href="\/manifest\.json(?:\?[^"]*)?"/g,
      'href="/manifest.json?v=' + version + '"');
  if (next !== original) {
    writeFileSync(path, next);
    updated++;
  }
}
console.log('StudyLab approved icons verified; ' + updated + ' HTML icon references synchronized. No image files modified.');
