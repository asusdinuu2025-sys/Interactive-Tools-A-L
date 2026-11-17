/* Deployment-only CSS request reduction. Preserve every rule and cascade boundary.
   Bundles sit beside source CSS so all relative image/font URLs retain their meaning. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
let before = 0, after = 0;
for (const file of readdirSync('.').filter(x => x.endsWith('.html'))) {
  let html = readFileSync(file, 'utf8');
  // Never combine across inline styles/scripts or links with media/other semantics.
  const link = '<link\\s+rel="stylesheet"\\s+href="(assets/css/[^"?]+\\.css)(?:\\?[^" ]*)?"\\s*/?>';
  const run = new RegExp('(?:' + link + '\\s*){2,}', 'g');
  html = html.replace(run, group => {
    const paths = [...group.matchAll(new RegExp(link, 'g'))].map(match => match[1]);
    if (paths.some(path => !existsSync(path) || /sl-bundle-/.test(path))) return group;
    const sources = paths.map(path => readFileSync(path, 'utf8'));
    // @import and @charset have ordering rules that concatenation could invalidate.
    if (sources.some(css => /@(?:import|charset)\b/i.test(css))) return group;
    const css = sources.map((text, i) => `/* ${paths[i]} */\n${text}\n`).join('\n');
    const hash = createHash('sha256').update(css).digest('hex').slice(0, 16);
    const path = `assets/css/sl-bundle-${hash}.css`;
    writeFileSync(path, css);
    before += paths.length; after++;
    return `<link rel="stylesheet" href="${path}">\n`;
  });
  writeFileSync(file, html);
}
console.log(`CSS request groups: ${before} source links → ${after} content-hashed bundles; source rules preserved.`);
