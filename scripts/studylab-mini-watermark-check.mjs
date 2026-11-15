/* Isolated decorative watermark and Midnight Blue mini timer regression.
   Aiming to protect all active Study Room time/presence/state logic. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const room=read("study-room.html");
const standalone=read("study-room-mini.html");
const pipJs=read("assets/js/study-room-mini-timer.js");
const mini=read("assets/css/study-room-mini-glass.css");
const illustrated=read("assets/css/study-room-illustrated-glass.css");
const themeCss=read("assets/css/study-room-themes.css");
const watermark='<div class="slr-room-name-watermark" aria-hidden="true"><span class="slr-room-name-brand">StudyLab</span><span class="slr-room-name-title">Live Study Room</span></div>';
assert.equal(room.split(watermark).length-1,1,"Watermark must appear once and be aria-hidden");
assert.match(illustrated,/body\.study-room-page \.slr-room-name-watermark\{/);
assert.match(illustrated,/font-family:"Bahnschrift SemiCondensed"/);
assert.match(illustrated,/color-mix\(in srgb,var\(--room-accent\) 72%,var\(--room-text\) 28%\)/);
assert.match(illustrated,/pointer-events:none;user-select:none/);
assert.match(illustrated,/data-room-mode="light"\] \.slr-room-name-watermark/);
assert.match(illustrated,/data-room-doodles="off"\] \.slr-room-name-watermark/);
assert.match(illustrated,/@media\(max-width:1160px\)/);
for(const t of ["midnight-blue","ocean","forest-green","pinky","lavender","warm-sand","mint","charcoal"]){
  assert.ok(themeCss.includes('data-room-theme="'+t+'"') || ["mint","charcoal"].some(x=>t===x&&themeCss.includes('data-room-theme-choice="'+x+'"')),
    "Theme support unexpectedly changed: "+t);
}
assert.match(mini,/:root\[data-room-theme="midnight-blue"\]\{--mini-base:#0b1030;/);
assert.match(mini,/body\.study-room-page\[data-room-theme="midnight-blue"\]\{/);
assert.match(mini,/--mini-accent:#838cff/);
assert.match(mini,/:root\[data-room-theme="ocean"\]\[data-room-mode="dark"\]\{--mini-base:#0c1c24;/);
assert.match(mini,/--mini-accent:#65d6e8/);
assert.match(room,/study-room-illustrated-glass\.css\?v=20261115-room-watermark-v7/);
assert.match(room,/study-room-mini-glass\.css\?v=20261115-midnight-indigo-v2/);
assert.match(room,/study-room-mini-timer\.js\?v=20261115-mini-color-css-v3/);
assert.match(standalone,/study-room-mini-glass\.css\?v=20261115-midnight-indigo-v2/);
assert.match(pipJs,/study-room-mini-glass\.css\?v=20261115-midnight-indigo-v2/);
assert.match(pipJs,/window\.StudyRoomPresenceController\?\.addWindow\(pipWindow\)/);
assert.match(pipJs,/api\.getState\(\)/);
console.log("Midnight Blue mini-timer color and Study Room decorative watermark checks passed.");
