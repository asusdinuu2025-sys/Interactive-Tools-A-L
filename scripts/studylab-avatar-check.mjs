/* Regression checks for optional StudyLab avatar lifecycle and UI placement. */
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const read = path => readFileSync(path,"utf8");
const avatar=read("assets/js/studylab-avatar.js");
const migration=read("supabase/migrations/20261115145000_studylab_profile_avatars.sql");
const viewer=read("assets/js/studylab-profile-view.js");
const social=read("assets/js/studylab-social.js");
const room=read("assets/js/study-room-realtime.js");
const css=read("assets/css/studylab-avatar.css");
const accountDelete=read("supabase/functions/studylab-delete-account/index.ts");
const legacyDelete=read("netlify/functions/delete-account.js");

assert.match(avatar,/MAX_UPLOAD = 1024 \* 1024/);
assert.match(avatar,/PHOTO_SIZE = 320/);
assert.match(avatar,/\["image\/jpeg","image\/png","image\/webp"\]/);
assert.match(avatar,/ctx\.drawImage\(image/);
assert.match(avatar,/canvas\.toBlob\(resolve,"image\/webp",quality\)/);
assert.match(avatar,/URL\.revokeObjectURL\(objectUrl\)/);
assert.match(avatar,/bucket\.upload\(path,blob,\{/);
assert.match(avatar,/bucket\.update\(path,blob,/);
assert.match(viewer,/avatarPick = element\("label","sl-pv-avatar-upload"/);
assert.match(avatar,/\.remove\(\[pathFor\(uid\)\]\)/);
assert.match(avatar,/\.in\("user_id",block\)/);
assert.match(avatar,/window\.StudyLabAvatar = Object\.freeze/);

assert.match(migration,/insert into storage\.buckets/);
assert.match(migration,/'studylab-avatars','studylab-avatars',true,184320/);
assert.match(migration,/references auth\.users\(id\) on delete cascade/);
assert.match(migration,/enable row level security/);
assert.match(migration,/using \(user_id = \(select auth\.uid\(\)\)/);
assert.match(migration,/with check \(user_id = \(select auth\.uid\(\)\)/);
assert.match(migration,/name = \(select auth\.uid\(\)\)::text \|\| '\/avatar\.webp'/);
assert.match(migration,/for insert to authenticated/);
assert.match(migration,/for update to authenticated/);
assert.match(migration,/for delete to authenticated/);

assert.match(viewer,/avatarEditor\.hidden=!own/);
assert.match(viewer,/window\.StudyLabAvatar\.save\(file\)/);
assert.match(viewer,/window\.StudyLabAvatar\.remove\(\)/);
assert.match(viewer,/window\.StudyLabAvatar\?\.decorate\(avatarNode,id\)/);
assert.match(viewer,/Photos are visible to other students/);
for(const page of ["index.html","study-room.html"]){
  const html=read(page);
  assert.match(html,/assets\/css\/studylab-avatar\.css/);
  assert.match(html,/assets\/js\/studylab-avatar\.js/);
  assert.ok(html.indexOf("studylab-account.js") < html.indexOf("studylab-avatar.js"));
  assert.ok(html.indexOf("studylab-avatar.js") < html.indexOf("studylab-profile-view.js"));
  // Never expose image upload in general Edit Profile forms.
  const editForm=html.slice(html.indexOf('id="profileModal"'),html.indexOf('id="profileModal"')+10000);
  assert.ok(!editForm.includes("sl-pv-avatar-upload"));
}
assert.match(social,/StudyLabAvatar\?\.decorate\(avatar,post\.author_id\)/);
assert.match(social,/StudyLabAvatar\?\.decorate\(commentAvatar,comment\.author_id\)/);
assert.match(social,/StudyLabAvatar\?\.decorate\(avatar,member\.author_id\)/);
assert.match(room,/StudyLabAvatar\?\.decorate\(avatar,id\)/);
assert.match(css,/sl-avatar-has-image > svg/);
assert.match(css,/slr-crown-avatar::before/);
assert.match(accountDelete,/\.storage\.from\("studylab-avatars"\)/);
assert.match(legacyDelete,/\/storage\/v1\/object\/studylab-avatars/);
console.log("StudyLab avatar lifecycle checks passed.");
