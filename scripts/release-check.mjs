import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const errors = [];
const requiredPages = ["index.html", "study-room.html", "study-room-mini.html", "study-tools.html", "exam-hub.html"];
const syntaxFiles = [
  "assets/js/studylab-social.js",
  "assets/js/study-room-analytics.js",
  "assets/js/study-room-mini-standalone.js",
  "assets/js/study-room-presence.js",
  "assets/js/study-room-realtime.js",
  "assets/js/study-room-subject-picker.js",
  "assets/js/interior-neon-doodles.js",
  "assets/js/study-room-enhancements.js",
  "assets/js/ai-response-renderer.js",
  "assets/js/ai-tutor.js",
  "assets/js/study-dashboard.js",
  "assets/js/past-paper-finder.js",
  "assets/js/main.js",
  "netlify/functions/gemini.js"
];

function fail(message) {
  errors.push(message);
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail("Missing required file: " + relativePath);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function attribute(attributes, name) {
  const singleQuoted = attributes.match(new RegExp("\\b" + name + "\\s*=\\s*'([^']*)'", "i"));
  const doubleQuoted = attributes.match(new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"', "i"));
  const match = singleQuoted || doubleQuoted;
  return match ? match[1] : "";
}

function localFile(page, reference) {
  const value = String(reference || "").trim();
  if (!value || value.startsWith("#") || /^(?:https?:|data:|mailto:|tel:|javascript:|blob:)/i.test(value)) return null;
  const clean = value.split(/[?#]/, 1)[0];
  if (!clean) return null;
  return clean.startsWith("/")
    ? path.join(root, decodeURIComponent(clean.slice(1)))
    : path.resolve(root, path.dirname(path.join(root, page)), decodeURIComponent(clean));
}

function checkNode(filePath, label) {
  const result = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    fail("JavaScript syntax error in " + label + ":\n" + (result.stderr || result.stdout || "node --check failed"));
  }
}

for (const page of requiredPages) {
  const html = read(page);
  if (!html) continue;

  if (!/<meta\s+name=["']viewport["'][^>]*>/i.test(html)) {
    fail(page + " is missing a viewport meta tag.");
  }
  if (/<meta\s+name=["']viewport["'][^>]*(?:user-scalable\s*=\s*no|maximum-scale\s*=\s*1)/i.test(html)) {
    fail(page + " prevents normal mobile zoom.");
  }

  if (page === "study-room.html" || page === "study-room-mini.html") {
    if (!/<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
      fail(page + " should remain noindex.");
    }
  }

  const loadedStyles = new Set();
  for (const match of html.matchAll(/<(script|link)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const reference = tag === "script" ? attribute(attrs, "src") : attribute(attrs, "href");
    if (tag === "link" && !/\brel=["'][^"']*stylesheet|manifest|icon/i.test(attrs)) continue;
    if (!reference) continue;
    if (tag === "link" && /\brel=["'][^"']*stylesheet/i.test(attrs)) {
      const normalized = reference.split(/[?#]/, 1)[0];
      if (loadedStyles.has(normalized)) fail(page + " loads stylesheet twice: " + normalized);
      loadedStyles.add(normalized);
    }
    const target = localFile(page, reference);
    if (target && !existsSync(target)) {
      fail(page + " references a missing local " + (tag === "script" ? "script" : "asset") + ": " + reference);
    }
  }
}

// Check the JavaScript files changed by the final Study Room and Social work.
for (const file of syntaxFiles) {
  const absolutePath = path.join(root, file);
  if (!existsSync(absolutePath)) fail("Missing JavaScript file: " + file);
  else checkNode(absolutePath, file);
}


const timerTests = spawnSync(process.execPath, ["scripts/study-room-target-tests.mjs"], { encoding: "utf8" });
if (timerTests.status !== 0) {
  fail("Study Room target/presence logic tests failed:\n" + (timerTests.stderr || timerTests.stdout || "node test failed"));
}

// Mock authenticated AI requests to catch token parser and quota regressions.
const aiTests = spawnSync(process.execPath, ["scripts/ai-quota-smoke-tests.cjs"], {encoding:"utf8"});
if (aiTests.status !== 0) {
  fail("StudyLab AI quota smoke tests failed:\n" +
    (aiTests.stderr || aiTests.stdout || "node test failed"));
}

// Exercise every interior page's icon set, theme isolation and Doodles off.
const neonTests = spawnSync(process.execPath, ["scripts/interior-neon-check.mjs"], {encoding:"utf8"});
if (neonTests.status !== 0) {
  fail("Interior neon/glass checks failed:\n" +
    (neonTests.stderr || neonTests.stdout || "node test failed"));
}

// Parse inline JavaScript in the standalone Study Tools page without executing it.
const toolsHtml = read("study-tools.html");
if (toolsHtml) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "studylab-release-check-"));
  try {
    let index = 0;
    for (const match of toolsHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const attrs = match[1];
      if (/\bsrc\s*=/i.test(attrs)) continue;
      const type = attribute(attrs, "type").toLowerCase();
      if (type && !/^(?:module|text\/(?:java|ecma)script|application\/(?:java|ecma)script)$/.test(type)) continue;
      const extension = type === "module" ? ".mjs" : ".js";
      const tempFile = path.join(tempDir, "inline-" + (++index) + extension);
      writeFileSync(tempFile, match[2], "utf8");
      checkNode(tempFile, "study-tools.html inline script #" + index);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// Validate the sitemap declaration, duplicate URLs and every local URL target.
const sitemap = read("sitemap.xml");
if (sitemap) {
  if (!/^\s*<\?xml\s+version=["']1\.0["']/i.test(sitemap)) {
    fail("sitemap.xml must begin with an XML declaration.");
  }
  if (!/<urlset\b[\s\S]*<\/urlset>/i.test(sitemap)) {
    fail("sitemap.xml has no complete urlset.");
  }
  const locations = [...sitemap.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map(match => match[1].trim());
  if (!locations.length) fail("sitemap.xml contains no URL entries.");

  const seen = new Set();
  for (const location of locations) {
    if (seen.has(location)) fail("Duplicate sitemap URL: " + location);
    seen.add(location);
    try {
      const url = new URL(location);
      if (url.origin !== "https://studylablk.netlify.app") {
        fail("Unexpected sitemap origin: " + url.origin);
        continue;
      }
      const relative = decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "index.html";
      const target = path.join(root, relative);
      if (!existsSync(target)) fail("Sitemap target does not exist: " + url.pathname);
    } catch {
      fail("Invalid sitemap URL: " + location);
    }
  }
}

if (errors.length) {
  console.error("StudyLab release checks failed:");
  for (const error of errors) console.error(" - " + error);
  process.exitCode = 1;
} else {
  console.log("StudyLab release checks passed.");
  console.log("Checked core page assets, mobile zoom, noindex rules, changed JavaScript syntax and sitemap targets.");
}
