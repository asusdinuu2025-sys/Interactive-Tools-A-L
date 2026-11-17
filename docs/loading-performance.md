# Loading and animation optimization (PR #105)

Baseline: PR #104's merged release, `81f3f438188f526d3b63325ea34d8fdbaf3c7173`.

The early loading block is generated from `assets/js/page-boot.js` and
`assets/css/page-boot.css` by `node scripts/sync-page-boot.mjs`. Run that command
when editing either source. It restores the saved theme before page styles are
painted, covers startup with a CSS neon indicator, then reveals the initialized
page after DOM handlers, initial published content and auth settle. It bounds
network waiting at 3 seconds after DOMContentLoaded and has a 12-second hard
recovery if a script hangs. A very slow API may still populate its content after
that recovery; the site is never permanently hidden. No-JavaScript browsing is
not hidden. The existing first-session welcome animation remains present.

The Study Room restores its local palette/mode/doodles before its content is
parsed. Its own controller remains responsible for later changes. Native page
and theme transitions are progressive enhancements and honor reduced motion.
Existing panel transitions, layouts and responsive rules remain unchanged.

The removed splash canvas no longer runs invisibly. Disabled/hidden pets suspend
their life loop and resume when enabled/visible; their personalities, controls
and goal celebration remain. Pointer glow rendering is coalesced to one update
per animation frame. Background-tab CSS animations pause without changing data
or presence timers.

Netlify's final build step combines only consecutive local stylesheet links
with identical loading semantics. Inline styles, scripts, media attributes and
other boundaries stay in place. Bundles remain in `assets/css/`, preserving
relative URLs. No CSS rules are removed or reordered. Content hashes allow
immutable caching; HTML revalidates. Source HTML remains editable without a
bundler. Pet CSS retains its own link so runtime detection does not load it twice.

Validation: `node scripts/release-check.mjs`, `npm run test:admin`,
`node scripts/studylab-admin-config-verify.mjs`, and
`node scripts/loading-performance-tests.cjs`. The last test covers early themes,
blocked storage, failed/slow startup, pet suspension/resumption, repeat splash,
exact CSS content/order preservation and repeated-build stability. It runs in CI.
Browser checks cover guest entry, profile dismissal, light-mode persistence on
reload, and 390px Home/Maths layouts. These are browser viewport checks, not
measurements from a physical low-end phone. No percentage FPS claim is made.
