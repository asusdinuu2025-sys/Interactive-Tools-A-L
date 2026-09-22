import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BASE_URL = "https://studylablk.netlify.app/";

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;

    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectHtmlFiles(absolute));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      files.push(absolute);
    }
  }

  return files;
}

const files = (await collectHtmlFiles(ROOT))
  .map(file => path.relative(ROOT, file).split(path.sep).join("/"))
  .sort();

const urls = files.map(relative => {
  if (relative === "index.html") {
    return "  <url><loc>" + BASE_URL + "</loc></url>";
  }

  const encoded = relative
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");

  return "  <url><loc>" + xmlEscape(BASE_URL + encoded) + "</loc></url>";
});

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.join("\n") +
  '\n</urlset>\n';

await writeFile(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");
console.log("Generated sitemap.xml with " + urls.length + " HTML URLs.");
