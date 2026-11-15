/* StudyLab data lifecycle and compact layout regressions. Read-only.
   No Supabase row, Auth identity or Storage object is mutated by this test. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(name,"utf8");
const home=read("assets/js/home-panels.js");
const room=read("assets/js/study-room-realtime.js");
const analytics=read("assets/js/study-room-analytics.js");
const roomCss=read("assets/css/study-room-illustrated-glass.css");
const accountDelete=read("netlify/functions/delete-account.js");
const profileViewer=read("assets/js/studylab-profile-view.js");
const posts=read("assets/js/studylab-social.js");
const edge=read("supabase/functions/studylab-delete-post/index.ts");
const accountEdge=read("supabase/functions/studylab-delete-account/index.ts");
const archive=read("supabase/migrations/20261115095418_privacy_safe_profile_retention_on_delete_20261115.sql");
const progress=read("supabase/migrations/20261115095425_study_room_inactive_progress_30_days_20261115.sql");

// 1. Home occupancy matches the LIVE ROOM cards rather than its old 90s gate.
assert.match(room,/const active = rows\.filter\(r => heartbeatIsFresh\(r\) \|\|\s*\(r\?\.session_active && r\?\.session_presence_state === 'away'\)\)/);
assert.match(home,/const shownInRoom = Boolean\(row\.is_studying && row\.last_heartbeat_at\) \|\|\s*Boolean\(row\.session_active && row\.session_presence_state === "away"\)/);
assert.ok(!home.includes("now - beat > 90000"),"Old Home-only 90-second cutoff must be removed");
assert.ok(home.includes("occupancyNodes.forEach"),"Both Home room cards must use one count");

// 2. Keep the five visible history rows without the removed CSV export.
assert.ok(analytics.includes("cloudSessions.slice(0,5)"),"History preview must show at most 5 rows");
assert.ok(analytics.includes("renderSessionHistory()"),"Recent session history must still render");
assert.ok(!analytics.includes("slHistoryExport"),"Removed CSV button must not return");
assert.ok(!analytics.includes("exportStudyHistory"),"Removed CSV export handler must not return");
assert.ok(!analytics.includes('anchor.download="studylab-study-history.csv"'));
assert.ok(!analytics.includes("cloudSessions.slice(0,25)"));

// 3. Long names and five-phone-item nav cannot resize or wrap cards.
assert.ok(roomCss.includes("text-overflow:ellipsis!important"));
assert.ok(roomCss.includes("white-space:nowrap!important"));
assert.ok(roomCss.includes(".room-person-card-name-row .room-person-card-name"));
assert.ok(room.includes("liveName.title=r.display_name||'Student'"),
  "Full long name must still be available in tooltip");
assert.ok(roomCss.includes("@media(max-width:600px)"));
assert.ok(roomCss.includes("grid-template-columns:repeat(5,minmax(0,1fr))!important"));
assert.ok(roomCss.includes("grid-auto-flow:column!important"));

// 4. Account deletion: one anonymized profile row retained, not login or data.
assert.ok(archive.includes("drop constraint if exists studylab_profiles_id_fkey"),
  "Orphan profile must survive Auth delete");
assert.ok(archive.includes("before delete on auth.users"),"Anonymization must be server-triggered");
for(const field of ["school = null","phone = null","bio = null","profile_completed_at = null","deleted_at = now()"]){
  assert.ok(archive.includes(field),"Deleted profile must erase private field "+field);
}
assert.ok(accountDelete.includes("checkProfileCanBePreserved(user.id)"),
  "Never delete Auth account if profile retention migration is missing");
assert.ok(accountDelete.includes("await removeSocialFiles(user.id)"),
  "Delete account must remove social media storage");
assert.ok(accountDelete.includes("await removeChatMessages(user.id)"),
  "Delete account must remove chat messages that would otherwise become null-owner");
assert.ok(accountDelete.includes('"/auth/v1/admin/users/"'),
  "Deletion must be server-side and use verified Supabase Auth identity");
assert.ok(!accountDelete.includes("DELETE FROM public.study_room_personal_"),
  "Personal daily/sessions are read-only views; no direct view deletes");
assert.ok(profileViewer.includes('"studylab-delete-account",{body:{confirmation:"DELETE"}}'),
  "Delete Account button must use the authenticated Supabase function");
assert.ok(accountEdge.includes("service.auth.getUser(token)"),
  "Account deletion must verify the actual Supabase Auth user, not an input ID");
assert.ok(accountEdge.includes("service.auth.admin.deleteUser(uid)"),
  "Only the server can remove the verified Auth identity");
assert.ok(accountEdge.includes('select("id,deleted_at")'),
  "Archive migration must be checked before deleting the Auth identity");
assert.ok(accountEdge.includes("async function walk(prefix:string,depth:number)"),
  "Account deletion must walk nested Social user/post folders");
assert.ok(accountEdge.includes("service.storage.from(bucket).remove(files.slice(i,i+100))"),
  "Nested Social media must be deleted from Storage");
assert.ok(accountEdge.includes('.from("studylab_chat_messages")'),
  "Messages that use SET NULL foreign keys require explicit deletion");
assert.ok(profileViewer.includes("Only one anonymized profile record remains"),
  "Deletion confirmation must disclose the retained profile row");

// 5. Post delete uses scoped Auth, server storage and ON DELETE CASCADE.
assert.ok(posts.includes('client.functions.invoke('));
assert.ok(posts.includes('"studylab-delete-post",{body:{post_id:post.id}}'));
assert.ok(edge.includes("service.auth.getUser(token)"),
  "Post deletion must authenticate the caller with Supabase");
assert.ok(edge.includes("post.author_id!==me.id && me.app_metadata?.role!==\"admin\""),
  "Owners and authenticated admins only");
assert.ok(edge.includes('service.storage.from(storageBucket).remove('));
assert.ok(edge.includes('from("studylab_social_posts").delete()'));
assert.ok(edge.indexOf("service.storage.from(storageBucket).remove(") <
  edge.indexOf('from("studylab_social_posts").delete()'),
  "Storage must be cleaned before DB deletion, so failures don't leave orphan objects");

// 6. 30 days inactivity deletes ONLY study progress, never whole accounts.
assert.ok(progress.includes("last_room_visit_at timestamptz"));
assert.ok(progress.includes("returns void language plpgsql security definer"));
assert.ok(/v_user_id\s+uuid\s*:=\s*\(select auth\.uid\(\)\)/.test(progress),
  "Only current signed-in student may mark a real visit");
assert.ok(progress.includes("m.last_room_visit_at < now() - interval '30 days'"));
assert.ok(progress.includes("m.last_heartbeat_at < now() - interval '30 days'"));
assert.ok(progress.includes("delete from public.study_room_credit_segments where user_id=v_user_id"));
assert.ok(progress.includes("delete from public.study_room_members where user_id=v_user_id"));
assert.ok(!/delete\s+from\s+public\.studylab_(profiles|social_posts|follows)/i.test(progress));
assert.ok(!/delete\s+from\s+public\.study_room_personal_(daily|sessions)/i.test(progress),
  "Personal history is computed from credit segments; views are not writable");
assert.ok(progress.includes("'40 18 * * *'"),"Daily cleanup at 00:10 Sri Lanka time");
assert.ok(room.includes("await callRpc('study_room_record_visit')"),
  "Entering the Live Study Room must update visit timestamp");

console.log("StudyLab occupancy, five-row history, mobile/nav, full post/account deletion and 30-day progress checks passed.");
