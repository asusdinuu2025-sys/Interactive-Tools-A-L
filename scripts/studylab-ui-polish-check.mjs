/* Targeted UI regression checks: this patch must not touch StudyLab
   avatar data, Chat history, subject time crediting, or Supabase schema. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=path=>readFileSync(path,"utf8");
const profile=source("assets/js/studylab-profile-view.js");
const profileCss=source("assets/css/studylab-follow.css");
const chat=source("assets/js/chat.js");
const chatCss=source("assets/css/chat.css");
const roomHtml=source("study-room.html");
const roomCss=source("assets/css/study-room-illustrated-glass.css");
const homeHtml=source("index.html");

// Bio now has one displayed/editor container, never two stacked cards.
assert.match(profile,/bioSummary\.append\(bioEditor\)/);
assert.match(profile,/dialog\.append\(header,identity,avatarEditor,bioSummary,counts,actions,followAction,joined,viewStatus\)/);
assert.doesNotMatch(profile,/dialog\.append\(header,identity,avatarEditor,bioSummary,bioEditor,/);
assert.match(profile,/bioNode\.hidden=opening/);
assert.match(profile,/bioEditor\.hidden=!opening/);
assert.match(profile,/bioInput\.rows = 1/);
assert.match(profile,/Math\.min\(146,Math\.max\(45,bioInput\.scrollHeight\)\)/);
assert.match(profile,/bioEditToggle\.querySelector\("span"\)\.textContent=opening\?"Cancel":"Edit"/);
assert.match(profile,/account\.saveBio\(bioInput\.value\)/);
assert.match(profile,/35 characters/);
assert.match(profileCss,/\.sl-pv-bio-summary \.sl-pv-bio-editor/);
assert.match(profileCss,/\.sl-pv-bio-summary \.sl-pv-description\[hidden\]/);

// Original chat permissions, history limit, message logic remain present.
assert.match(chat,/maxMessages: 100/);
assert.match(chat,/maxLength: 500/);
assert.match(chat,/rateLimitMs: 2500/);
assert.match(chat,/study-chat-expand/);
assert.match(chat,/data-chat-expand/);
assert.match(chat,/setExpanded\(!isExpanded\)/);
assert.match(chat,/panel\.classList\.toggle\("is-expanded",isExpanded\)/);
assert.match(chat,/aria-pressed/);
assert.match(chat,/study-chat-message-name-text/);
assert.match(chat,/StudyLabNameMark\?\.decorate\(name,row\.user_id\)/);
assert.match(chat,/study-chat-option-delete/);
assert.match(chat,/iconSvg/);
assert.match(chat,/study-chat-context/);
assert.match(chat,/values\.reply_to=replyTarget/);
assert.match(chat,/query\.update\(\{reaction:symbol\}\)/);
assert.match(chat,/\.update\(\{message\}\)\.eq\("id",editingId\)\.eq\("user_id",userId\)/);

// Expanded CSS must defeat the Home sidebar's important width override.
assert.match(chatCss,/\.study-chat-panel\.is-expanded/);
assert.match(chatCss,/body:not\(\.study-room-page\) \.study-chat-panel\.is-expanded/);
assert.match(chatCss,/width:min\(700px,calc\(100vw - 285px\)\)!important/);
assert.match(chatCss,/\.study-chat-head-actions/);
assert.match(chatCss,/\.study-chat-message-name-text/);
assert.match(chatCss,/\.study-chat-message-name > \.sl-name-mark/);
assert.match(chatCss,/\.study-chat-message-menu\{/);
assert.match(chatCss,/background:#213750!important/);
assert.match(chatCss,/\.study-chat-option-delete/);
assert.match(chatCss,/\.study-chat-compose\{\s*display:grid!important/);
assert.match(chatCss,/grid-template-columns:minmax\(0,1fr\) 43px/);
assert.match(chatCss,/\.study-chat-context\{\s*grid-column:1\/-1/);

// The four circled empty regions reuse the user's existing themed SVG masks.
const addedClasses=[
  "corner-upper-left","corner-upper-right","corner-lower-left","corner-lower-right"
];
for(const part of addedClasses){
  const cssSelector=".slr-theme-illustration--"+part;
  assert.ok(roomHtml.includes("slr-theme-illustration--"+part),
    "Missing Study Room illustrated corner: "+part);
  assert.ok(roomCss.includes(cssSelector),
    "Missing themed corner positioning: "+part);
}
assert.match(roomCss,/--slr-art-mask: url\("\.\.\/images\/study-room\/lavender\.svg/);
assert.match(roomCss,/--slr-art-mask: url\("\.\.\/images\/study-room\/flower\.svg/);
assert.match(roomCss,/--slr-art-mask: url\("\.\.\/images\/study-room\/bubbles\.svg/);
assert.match(roomCss,/--slr-art-mask: url\("\.\.\/images\/study-room\/leaf\.svg/);
assert.match(roomCss,/--slr-art-mask: url\("\.\.\/images\/study-room\/turtle\.svg/);
assert.match(roomHtml,/data-room-doodles="on"/);
assert.match(roomCss,/\.slr-theme-illustrations/);
const addedCornerStyles=roomCss.split("/* Extra four corner illustrations")[1]||"";
assert.ok(addedCornerStyles,"Expected the new corner art CSS section");
assert.doesNotMatch(addedCornerStyles,/opacity:calc\(var\(--slr-art-opacity\) \* /,
  "New corner styles must not use unsupported opacity arithmetic");

for(const html of [roomHtml,homeHtml]){
  assert.match(html,/studylab-profile-view\.js\?v=20261115-inline-bio-v5/);
  assert.match(html,/studylab-follow\.css\?v=20261115-inline-bio-v5/);
  assert.match(html,/chat\.css\?v=20261115-layout-v2/);
  assert.match(html,/chat\.js\?v=20261115-layout-v2/);
  assert.match(html,/studylab-avatar\.js\?v=20261115-uuid-fixed-v5/,
    "Working photo renderer must stay on its tested version");
}
assert.match(roomHtml,/study-room-illustrated-glass\.css\?v=20261115-corner-icons-v4/);
console.log("Inline Bio, Chat layout/controls, badge spacing and illustrated corners passed.");
