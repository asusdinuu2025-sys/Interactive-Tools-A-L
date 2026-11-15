import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const html=read("index.html"), profile=read("assets/js/profile.js");
const ui=read("assets/js/studylab-announcements.js");
const css=read("assets/css/studylab-announcements.css");
const before=read("supabase/migrations/20261115230000_studylab_announcements.sql");
const migration=read("supabase/migrations/20261115233500_announcements_v2_admin_banners.sql");
const publicRead=read("supabase/migrations/20261115233600_announcements_public_read_policy.sql");
assert.doesNotThrow(()=>new vm.Script(ui,{filename:"studylab-announcements.js"}));
assert.doesNotThrow(()=>new vm.Script(profile,{filename:"profile.js"}));
for(const required of [
  'id="slDiscoveryCarousel"','data-discovery-main','data-discovery-prev',
  'data-discovery-next','data-discovery-dots','sl-home-intro-row',
  'homepage-utility-row',
  'assets/css/studylab-announcements.css?v=20261116-home-fade-pet-v3',
  'assets/js/studylab-announcements.js?v=20261116-home-fade-pet-v3'
])assert.ok(html.includes(required),"Missing Home integration: "+required);
assert.match(profile,/updates\.dataset\.accountAction="announcements"/);
assert.match(profile,/manage\.dataset\.accountAction="manage-announcements"/);
assert.match(profile,/nameText\.className="sl-greeting-name-text"/);
assert.match(profile,/profileNameText\.className="sl-header-profile-name-text"/);
assert.match(profile,/label\.replaceChildren\(profileNameText\)/);
assert.match(html,/assets\/js\/profile\.js\?v=20261116-header-name-v3/);
assert.match(profile,/window\.StudyLabNameMark\?\.decorate/);
assert.match(ui,/items=historyItems\.filter\(x=>!x\.ends_at/);
assert.match(ui,/\.order\("sort_order",\{ascending:true\}\)/);
assert.match(ui,/changeSlide\(current\+1\)/);
assert.match(ui,/function changeSlide\(index\)/);
assert.match(ui,/card\.classList\.add\("is-transitioning"\)/);
assert.match(ui,/card\.classList\.remove\("is-transitioning"\)/);
assert.match(ui,/},190\)/);
assert.match(ui,/if\(reduced\.matches\)/);
assert.match(ui,/},4000\)/);
assert.match(ui,/new IntersectionObserver/);
assert.match(ui,/reduced\.matches/);
assert.match(ui,/function navigate\(raw\)/);
for(const path of [
  '/#profile','/#social','/#study-chat','/#about-studylab',
  '/#practical-simulations'
])assert.ok(migration.includes(path),"Missing seeded link: "+path);
assert.match(ui,/function openProfile\(\)/);
assert.match(ui,/function openChat\(\)/);
assert.match(ui,/function openAbout\(\)/);
assert.match(ui,/card\.querySelector\("\[data-discovery-prev\]"\)/);
assert.match(ui,/card\.querySelector\("\[data-discovery-next\]"\)/);
assert.match(ui,/historyDialog=dialogShell\("slAnnouncementHistory"/);
assert.match(ui,/managerDialog=dialogShell\("slAnnouncementManager"/);
assert.match(ui,/client\.rpc\("studylab_social_is_admin"\)/);
assert.match(ui,/client\.from\("studylab_announcements"\)/);
assert.match(ui,/form\.addEventListener\("submit",async event=>\{/);
assert.match(ui,/client\.storage\.from\(BUCKET\)\.upload\(newImagePath,processed/);
assert.match(ui,/client\.storage\.from\(BUCKET\)\.remove\(\[oldImage\]\)/);
assert.match(ui,/client\.storage\.from\(BUCKET\)\.remove\(\[item\.image_path\]\)/);
assert.match(ui,/context\.drawImage\(img,cropX,cropY,cropW,cropH,0,0,W,H\)/);
assert.match(ui,/W=1200,H=480/);
assert.match(ui,/const BUCKET="studylab-announcements"/);
assert.match(ui,/MAX_SOURCE=8\*1024\*1024,MAX_FINAL=2\*1024\*1024/);
for(const deleted of [
  "studylab_announcement_reads","markSeen(","loadReceipts(",
  "receipts=new Map(","localStorage.","viewed_at","dismissed_at","opened_at"
])assert.ok(!ui.includes(deleted),"Obsolete read tracking in frontend: "+deleted);
assert.match(migration,/drop table if exists public\.studylab_announcement_reads/);
assert.match(migration,/update auth\.users/);
assert.match(migration,/is_anonymous=true/);
assert.match(migration,/and \(select auth\.uid\(\)\) in/);
assert.match(migration,/create policy "StudyLab admin adds announcement images"/);
assert.match(migration,/create policy "StudyLab admin deletes announcement images"/);
assert.match(migration,/file_size_limit/);
assert.match(publicRead,/for select to anon,authenticated using \(published and starts_at <= now\(\)\)/);
assert.match(publicRead,/for select to authenticated using \(\(select public\.studylab_social_is_admin\(\)\)\)/);
assert.match(before,/alter table public\.studylab_announcements enable row level security/);
for(const title of [
  "Profile pictures are here!","Follow and connect","Live Study Room",
  "StudyLab Social","StudyLab Chat","Practical Simulations","About StudyLab"
])assert.ok(migration.includes(title),"Missing published default banner: "+title);
assert.match(css,/@media\(max-width:1120px\)/);
assert.match(css,/@media\(max-width:540px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/html\[data-theme="light"\] \.sl-discovery-card/);
assert.match(css,/text-overflow:ellipsis/);
assert.match(css,/\.sl-discovery-custom-image/);
assert.match(css,/\.sl-discovery-card\.has-uploaded-banner/);
assert.match(css,/\.sl-ann-image-preview/);
assert.match(css,/\.sl-header-profile-name-text/);
assert.match(css,/\.profile-button-label > \.sl-name-mark/);
assert.match(css,/max-width:clamp\(140px,22vw,270px\)/);
assert.match(css,/\.sl-discovery-card\.is-transitioning \.sl-discovery-slide-main/);
assert.match(css,/transition-duration:\.18s/);
assert.match(css,/html body #studylabPetStage\{\s*z-index:2147483400!important/);
assert.match(css,/html body #studylabPetPanel\{\s*z-index:2147483402!important/);
console.log("StudyLab seven published banners, admin editor, images, no read-tracking and mobile layout: OK.");
