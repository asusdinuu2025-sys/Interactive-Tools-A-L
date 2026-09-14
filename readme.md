# E-tools for G.C.E A/L Sri Lanka

A static educational website with interactive tools for Sri Lankan G.C.E. Advanced Level students, covering Mathematics, Biology, Chemistry and Physics.

Built with plain HTML, CSS and JavaScript only — no framework, no build step, no Node.js required to run it.

## Project structure

```
E-tools/
├── index.html            Homepage with 4 subject cards
├── maths.html            Mathematics tool directory
├── biology.html          Biology tool directory
├── chemistry.html        Chemistry tool directory
├── physics.html          Physics tool directory
│
├── assets/
│   ├── css/main.css      Shared styling (theme, layout, cards)
│   └── js/main.js        Shared JS (dark/light mode + localStorage)
│
└── tools/
    ├── maths/
    ├── biology/
    ├── chemistry/
    │   └── nh3-cations.html
    └── physics/
```

## 1. Run the website locally

No build step or server is strictly required — you can just open `index.html` in a browser.

For best results (correct relative paths, live reload), use a simple local server:

```bash
# Option A — Netlify CLI (recommended, matches production)
netlify dev

# Option B — any static file server
npx serve .
```

Then visit the printed local URL.

## 2. Add a new subject tool (a new card on a subject page)

1. Open the relevant subject page (`chemistry.html`, `maths.html`, `biology.html`, or `physics.html`).
2. Find the HTML comment that says `ADD NEW <SUBJECT> TOOL CARDS HERE`.
3. Copy one existing `<a class="tool-card">...</a>` block and paste it just above that comment.
4. Update the `href`, icon emoji, title and description.

You do **not** need to touch the homepage or any other tool file.

## 3. Add a new individual HTML tool

1. Create a new `.html` file inside the matching folder, e.g. `tools/physics/projectile-motion.html`.
2. If you have a complete standalone HTML document (starting with `<!DOCTYPE html>`), paste it in directly — no conversion needed. It does not need to reference the shared CSS/JS.
3. Add a "Back to <Subject>" link at the bottom pointing back two levels up, e.g. `../../physics.html`.
4. Link to the new file from the relevant subject page (see step 2 above).

## 4. Where tool files are stored

Each subject has its own folder under `tools/`:

- `tools/maths/`
- `tools/biology/`
- `tools/chemistry/`
- `tools/physics/`

Every tool is a single, self-contained `.html` file inside its subject folder.

## 5. Deploy / update the site on Netlify

This is a static site — no build command and no Node.js is required.

- **Netlify UI:** drag and drop the project folder onto [app.netlify.com/drop](https://app.netlify.com/drop), or connect the Git repository and leave the build command empty with publish directory set to the project root (`.`).
- **Netlify CLI:**

```bash
netlify deploy --prod
```

To update the live site later, just edit the HTML/CSS/JS files and redeploy (or push to Git if the site is connected to a repository).

## 6. Change the Telegram developer link

The footer link "Developed by Dinusha ツ" appears in every page (`index.html`, `maths.html`, `biology.html`, `chemistry.html`, `physics.html`). To change it, find this block in each file and update the `href`:

```html
<a class="dev-link" href="https://t.me/dinusha_official" target="_blank" rel="noopener noreferrer">
  Dinusha ツ
</a>
```

## Notes

- Light/dark theme preference is remembered per-browser using `localStorage`.
- All navigation uses relative paths, so the site works identically locally and on Netlify.
