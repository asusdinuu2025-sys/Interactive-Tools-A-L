import { cp, mkdir, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

const EXCLUDED = new Set([
  ".git",
  ".github",
  "node_modules",
  "dist",
  "netlify",
  "scripts",
  "package.json",
  "package-lock.json",
  "readme.md",
  "agents.md",
  "netlify.toml"
]);

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

/*
 * Generate the sitemap from the source tree before copying the public files.
 * The generated sitemap is then copied into dist with the rest of the site.
 */
await import(pathToFileURL(path.join(ROOT, "scripts/generate-sitemap.mjs")).href);

const entries = await readdir(ROOT, { withFileTypes: true });

for (const entry of entries) {
  if (EXCLUDED.has(entry.name)) continue;

  const source = path.join(ROOT, entry.name);
  const target = path.join(DIST, entry.name);

  await cp(source, target, {
    recursive: true,
    force: true,
    filter: sourcePath => {
      const relative = path.relative(ROOT, sourcePath);
      const firstSegment = relative.split(path.sep)[0]?.toLowerCase();
      return !EXCLUDED.has(firstSegment);
    }
  });
}

console.log("StudyLab static site prepared in dist/.");
