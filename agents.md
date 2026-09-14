# AGENTS.md

## What this project is

A static educational website, "E-tools for G.C.E A/L Sri Lanka" — a directory of interactive HTML tools for Sri Lankan Advanced Level students, organized by subject (Maths, Biology, Chemistry, Physics).

## Architecture

- Plain HTML + CSS + JavaScript. No framework, no bundler, no build step, no package.json.
- `index.html` is the homepage with 4 subject cards linking to `maths.html`, `biology.html`, `chemistry.html`, `physics.html`.
- Each subject page is a static directory of "tool cards" linking to individual tool files under `tools/<subject>/`.
- Every tool lives in its own standalone `.html` file. Tool files are intentionally NOT required to reference `assets/css/main.css` or `assets/js/main.js` — the design lets a user paste a complete, self-contained HTML document (their own simulator/tool) directly into a tool file without any conversion. See `tools/chemistry/nh3-cations.html` for the current placeholder example, which inlines its own `<style>` for this reason.
- Shared styling for the homepage and subject pages lives in `assets/css/main.css` (theme variables, card/grid layout, glassmorphism). Shared behavior lives in `assets/js/main.js` (light/dark theme toggle persisted to `localStorage` under the key `etools-theme`).

## Conventions

- All internal links use relative paths (no absolute URLs, no leading `/`), so the site works both opened directly from disk and when deployed to Netlify.
- Subject pages mark an explicit insertion point with an HTML comment (`ADD NEW <SUBJECT> TOOL CARDS HERE`) — new tool cards should be added just above that comment by duplicating an existing `<a class="tool-card">` block.
- Placeholder tools/links use `href="#placeholder"` until a real tool file exists.
- Theme variables are defined once in `:root` in `main.css` and overridden under `[data-theme="light"]`; `data-theme` is set on `<html>` by `main.js`.

## Non-obvious decisions

- No React/Vue/build tooling by explicit user requirement — keep everything editable as flat HTML files.
- Tool HTML files are not templated/included via server-side includes or JS fetch — each is a fully independent static file so users can paste arbitrary standalone HTML documents (including their own `<head>`, `<style>`, `<script>`) without breaking the rest of the site.
- No Netlify Functions, database, or forms are used — this project has no backend/persistence needs.

## Deployment

Static site, no build command. Publish directory is the project root.
