/* Regression checks for direct Bio editing, clear gender state, Live Study Room
   profile navigation, adaptive glass, and mini timer first-paint protection. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const profile=read("assets/js/profile.js");
const viewer=read("assets/js/studylab-profile-view.js");
const account=read("assets/js/studylab-account.js");
const room=read("assets/js/study-room-realtime.js");
const roomHtml=read("study-room.html");
const homeHtml=read("index.html");
const themeCss=read("assets/css/studylab-follow.css");
const pip=read("assets/js/study-room-mini-timer.js");
const popup=read("study-room-mini.html");

// 1. Owner Bio is editable only in existing View Profile, visitors read it.
for(const [name,html] of [["Home",homeHtml],["Study Room",roomHtml]]){
  assert.ok(!html.includes('id="profileBio"'),name+" Edit Profile must have NO Bio input");
  assert.ok(!html.includes('id="profileBioCount"'),name+" old Bio counter must be gone");
  assert.ok(html.includes('id="profileForm"'),name+" current Edit Profile form must remain");
  assert.ok(html.includes('data-profile-gender="male"')&&html.includes('data-profile-gender="female"'),
    name+" existing gender picker must remain");
}
assert.ok(!profile.includes('document.getElementById("profileBio")'));
assert.ok(!profile.includes("bioWords("));
assert.ok(!account.includes("bio: bio || null"),"Normal profile save must never clear the bio");
assert.ok(account.includes("async function saveBio(value)")&&account.includes("getProfile, saveProfile, saveBio"));
assert.match(account,/\.update\(\{bio:\s*cleanBio\s*\|\|\s*null/);
assert.ok(account.includes('.eq("id", user.id)'),
  "Dedicated Save Bio must update only the signed-in user's own row");
assert.ok(account.includes("Array.from(cleanBio).length > 18"),"Bio edits must be limited to 18 characters");
assert.ok(viewer.includes("bioEditor.hidden=!own")&&viewer.includes("bioNode.hidden=own"),
  "Owner can edit and visitors can only read");
assert.ok(viewer.includes("bioInput.maxLength = 240"),"Legacy longer bios must remain readable until edited");
assert.ok(viewer.includes("bioSave.addEventListener")&&viewer.includes("account.saveBio(bioInput.value)"));
assert.ok(viewer.includes('bioStatus.textContent="Bio saved."'),"Save confirmation missing");
assert.ok(viewer.includes("bioInput.setAttribute")&&viewer.includes('bioCount.textContent=count+" / 18 characters"'));

// 2. Clearly visible and accessible gender selection works in both forms.
assert.ok(profile.includes("showSelectedGender();"),"Selection feedback not wired");
assert.ok(profile.includes('profileGenderFeedback.setAttribute("aria-live","polite")'));
assert.ok(profile.includes('item.classList.toggle("is-selected", active)'));
assert.ok(profile.includes('button.classList.toggle("is-selected", active)'));
assert.ok(themeCss.includes('#profileModal .profile-gender-choice.is-selected[aria-pressed="true"]'),
  "Selected gender visual indicator must override legacy styles");
assert.ok(themeCss.includes('content:"✓"')&&themeCss.includes("sl-profile-gender-feedback"),
  "Selected gender needs visible check icon and text");

// 3. Live student names open exact shared profile card, with keyboard access.
assert.ok(room.includes('const showRoomProfile=()=>window.StudyLabProfileView?.open({userId:id})'),
  "Study Room names must open existing View Profile, not a new popup");
assert.ok(room.includes('nameTrigger.tabIndex=0')&&room.includes('event.key==="Enter"||event.key===" "'),
  "Keyboard users must be able to view Study Room profiles");
assert.ok(room.includes("room-person-follow-slot"),"Follow remains inside live student cards");
assert.ok(room.includes("slr-profile-name-trigger"));
assert.ok(themeCss.includes("slr-profile-name-trigger:focus-visible"));

// 4. Theme and light/dark mode are sourced from the Study Room's live palette.
assert.ok(themeCss.includes("body.study-room-page[data-room-theme] .sl-pv-dialog"));
assert.ok(themeCss.includes("var(--room-page-bg)")&&themeCss.includes("var(--room-accent)"));
assert.ok(themeCss.includes("body.study-room-page[data-room-mode=\"dark\"] .sl-pv-dialog"));
assert.ok(themeCss.includes("body.study-room-page[data-room-mode=\"light\"] .sl-pv-dialog"));
assert.ok(themeCss.includes(".room-person-follow-slot .sl-follow-btn.is-following"),
  "Following must be theme-aware, not just Follow");
assert.ok(themeCss.includes(".sl-pv-follow-action .sl-follow-btn.is-following"),
  "Visiting other students' profiles must follow room palette");

// 5. Mini timer: never show the pre-glass fallback UI during first paint.
assert.ok(pip.includes('doc.body.style.visibility="hidden"'));
assert.ok(pip.includes('glassLink.addEventListener("load"'));
assert.ok(pip.includes('doc.body.style.visibility="visible"'));
assert.ok(pip.indexOf('doc.body.style.visibility="hidden"') <
  pip.indexOf('doc.body.innerHTML='),"PiP document must be hidden before timer markup");
assert.ok(popup.includes("html:not(.sl-mini-glass-ready) body.sl-mini-window{visibility:hidden}"));
assert.ok(popup.indexOf("sl-mini-glass-ready")<popup.indexOf('<body class="sl-mini-window"'));
assert.ok(popup.includes('document.documentElement.classList.add("sl-mini-glass-ready")'));
assert.ok(pip.includes("window.StudyRoomPresenceController?.addWindow(pipWindow)"),
  "Mini timer presence logic must remain unchanged");
assert.ok(popup.includes('src="assets/js/study-room-mini-standalone.js?v=20261103-target-away-v1"'),
  "Standalone heartbeat timer must remain intact");

console.log("StudyLab Bio, gender, room profiles, palette adaptation and mini first-paint checks passed.");
