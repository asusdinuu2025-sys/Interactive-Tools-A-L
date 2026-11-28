/* Validate the exported icons and keep page-specific favicon links current. */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const version = 'sl-infinity-20261127';
const main = 'studylab-favicon';
const byPage = new Map([
  ['study-room.html', 'studylab-live-study-room'],
  ['study-room-mini.html', 'studylab-study-timer'],
  ['exam-hub.html', 'studylab-papers-lessons'],
  ['lesson-packs.html', 'studylab-papers-lessons'],
  ['smk-physics-lessons.html', 'studylab-papers-lessons'],
  ['generalenglish.html', 'studylab-papers-lessons'],
  ['generalknowledge.html', 'studylab-papers-lessons'],
  ['git.html', 'studylab-papers-lessons']
]);

const generated = /<!-- StudyLab favicons -->[\s\S]*?<!-- \/StudyLab favicons -->/;
const legacy = /<link\b(?=[^>]*\brel="icon")(?=[^>]*\bhref="\/?assets\/icon\/studylab-(?:pwa|favicon)\.svg(?:\?[^"]*)?")[^>]*>/i;
const extraPages = new Set(['study-room-mini.html', 'simulation-viewer.html']);

function stampIcons(page, html) {
  const stem = byPage.get(page) || main;
  const png = stem === main ? 'studylab-32' : stem + '-32';
  const icons = [
    '<!-- StudyLab favicons -->',
    '<link rel="icon" type="image/png" sizes="32x32" href="assets/icon/' + png + '.png?v=' + version + '">',
    '<link rel="icon" type="image/svg+xml" sizes="any" href="assets/icon/' + stem + '.svg?v=' + version + '">',
    '<!-- /StudyLab favicons -->'
  ].join('\n  ');
  let next = html;
  if (generated.test(next)) next = next.replace(generated, icons);
  else if (legacy.test(next)) next = next.replace(legacy, icons);
  else if (extraPages.has(page)) next = next.replace(/<\/title>/i, '</title>\n  ' + icons);
  return next
    .replace(/href="\/?assets\/icon\/(?:icon2|apple-touch-icon|studylab-180)\.png(?:\?[^"]*)?"/g,
      'href="assets/icon/apple-touch-icon.png?v=' + version + '"')
    .replace(/href="\/?manifest\.json(?:\?[^"]*)?"/g,
      'href="manifest.json?v=' + version + '"');
}

const root = process.cwd();
const iconDir = join(root, 'assets', 'icon');
const variantNames = new Set(byPage.values());
const pngSizes = [
  ['studylab-192.png', 192],
  ['studylab-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['studylab-maskable-512.png', 512],
  ['studylab-32.png', 32],
  ...Array.from(variantNames, stem => [stem + '-32.png', 32])
];
for (const [name, size] of pngSizes) {
  const png = readFileSync(join(iconDir, name));
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
    throw new Error('Invalid StudyLab icon format or size: ' + name);
  }
}
for (const stem of [main, 'studylab-pwa', ...variantNames]) {
  if (!existsSync(join(iconDir, stem + '.svg'))) {
    throw new Error('Missing StudyLab icon: ' + stem + '.svg');
  }
}

let updated = 0;
for (const page of readdirSync(root).filter(name => name.endsWith('.html'))) {
  const path = join(root, page);
  const original = readFileSync(path, 'utf8');
  const next = stampIcons(page, original);
  if (next === original) continue;
  writeFileSync(path, next);
  updated++;
}
console.log('StudyLab icons verified; ' + updated + ' pages synchronized.');
