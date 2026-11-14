/* Read-only regression for account menu icons and four subject filter layers. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const profile = readFileSync("assets/js/profile.js","utf8");
const hubCss = readFileSync("assets/css/subject-home-glass.css","utf8");
const commonCss = readFileSync("assets/css/main.css","utf8");
const lessonJs = readFileSync("assets/js/lesson-filter.js","utf8");

const view = profile.match(/data-account-action="view"[\s\S]{0,390}?(?=<\/button>)/);
assert.ok(view,"View Profile menu entry is missing");
assert.match(view[0],/account-menu-icon"[^>]*><svg viewBox="0 0 24 24"/,
  "View Profile must use an outline SVG profile icon");
assert.match(view[0],/<circle cx="12" cy="12" r="10"/,
  "View Profile must include circular profile frame");
assert.match(view[0],/<circle cx="12" cy="9" r="3\.2"/,
  "View Profile must include a person silhouette");
const edits=[...profile.matchAll(/data-account-action="profile"[\s\S]{0,380}?(?=<\/button>)/g)];
assert.equal(edits.length,2,"Both Guest and signed-in Edit Profile menu entries must exist");
for(const match of edits) {
  assert.match(match[0],/account-menu-icon"[^>]*><svg viewBox="0 0 24 24"/,
    "Edit Profile must use a vector pencil icon");
  assert.match(match[0],/M4 20 4\.2-.8L19 8\.4/,
    "Pencil icon path must be present");
}
assert.doesNotMatch(profile,/<span class="account-menu-icon" aria-hidden="true">[◎♙]<\/span>/,
  "Old placeholder symbols must be gone");
assert.match(profile,/\.account-menu-icon svg\s*\{/,
  "Icons must have a dedicated size and stroke style");

const intro=hubCss.match(/body\.sl-subject-hub \.sl-subject-intro-panel\s*\{([^}]*)\}/)?.[1];
const grid=hubCss.match(/body\.sl-subject-hub \.tool-grid\s*\{([^}]*)\}/)?.[1];
assert.ok(intro&&grid,"Subject intro and tool-grid CSS blocks required");
assert.match(intro,/position:\s*relative/);
assert.match(intro,/overflow:\s*visible/);
assert.match(intro,/z-index:\s*2\s*;/,"Subject intro must stack above tool cards");
assert.match(grid,/z-index:\s*1\s*;/,"Original tool grid stack should be unchanged");
assert.match(commonCss,/\.lesson-filter-menu\s*\{[\s\S]*?position:\s*absolute/);
assert.match(lessonJs,/menu\.hidden\s*=\s*!willOpen/,
  "Existing dropdown behavior should remain unchanged");

for(const page of ["maths.html","physics.html","chemistry.html","biology.html"]){
 const src=readFileSync(page,"utf8");
 assert.ok(src.includes('class="tool-grid"'),page+" is missing card grid");
 assert.ok(src.includes('class="lesson-filter"'),page+" is missing lesson dropdown");
 assert.ok(src.includes("assets/css/subject-home-glass.css"),page+" must load shared fix");
 assert.ok(src.includes("assets/js/lesson-filter.js"),page+" must load existing filtering logic");
}
console.log("Subject filter dropdown stacking and View/Edit Profile vector icon checks passed.");
