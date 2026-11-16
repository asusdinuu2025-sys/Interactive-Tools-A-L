/* Regression checks for the requested Chat-only changes.
   Existing Social Likes/Comments, avatars and Study Room remain untouched. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const chat=read("assets/js/chat.js");
const chatCss=read("assets/css/chat.css");
const social=read("assets/js/studylab-social.js");
const socialCss=read("assets/css/feed-drawer.css");
const socialMigration=read("supabase/migrations/20261115191500_social_post_emoji_reactions.sql");
const moderators=read("supabase/migrations/20261115193600_chat_moderator_delete_roles.sql");
const home=read("index.html"), room=read("study-room.html");

// Existing name-color logic is retained, including own-message cyan names.
assert.match(chat,/const senderColors = \[/);
assert.match(chat,/const senderColorIds = new Map\(\)/);
assert.match(chat,/const seed=uid\+"\|"\+sessionKey/);
assert.match(chat,/senderColorIds\.set\(uid,index\)/);
assert.match(chat,/if\(own\)article\.classList\.add\("own"\)/);
assert.match(chat,/--sl-chat-sender-dark/);
assert.match(chat,/--sl-chat-sender-light/);
assert.match(chat,/nameText\.title=nameText\.textContent/);
assert.match(chatCss,/\.study-chat-message-name-text\{/);
assert.match(chatCss,/text-overflow:ellipsis/);
assert.match(chatCss,/color:#52e0f0!important/);
assert.match(chatCss,/--sl-chat-sender-light/);

// Curved, integrated bubble tails replace polygon triangles.
// Incoming bubbles have a subtle neutral gradient, outgoing have cyan.
assert.match(chatCss,/content:none!important;display:none!important;clip-path:none!important/);
assert.match(chatCss,/border-radius:17px 17px 17px 4px!important/);
assert.match(chatCss,/border-radius:17px 17px 4px 17px!important/);
assert.match(chat,/function refreshDateSeparators\(\)/);
assert.match(chat,/function dateLabel\(date\)/);
assert.match(chat,/return "Today"/);
assert.match(chat,/return "Yesterday"/);
assert.match(chat,/separator\.setAttribute\("role","separator"\)/);
assert.match(chat,/if\(!existing\)refreshDateSeparators\(\)/);
assert.match(chat,/react\.setAttribute\("aria-expanded"/);
assert.match(chatCss,/\.study-chat-message\.is-reactions-open \.study-chat-reactions/);
assert.match(chat,/function messageReactions\(id, container, usedOnly = false\)/);
assert.match(chat,/if\(usedOnly && !used.length\)continue/);
assert.match(chat,/messageReactions\(id,usedReactions,true\)/);
assert.match(chat,/messageReactions\(row.id,usedReactions,true\)/);
assert.match(chat,/article.replaceChildren\(header,body,usedReactions,reactions,footer\)/);
assert.match(chatCss,/\.study-chat-reactions-used:empty\{display:none\}/);
assert.match(chatCss,/font-family:"Nirmala UI","Segoe UI",sans-serif!important/);
assert.match(chatCss,/font-size:10.5px/);
assert.match(chatCss,/\.study-chat-date-separator/);
assert.match(chatCss,/\.study-chat-message:not\(\.own\)\{/);
assert.match(chatCss,/\.study-chat-message\.own\{/);
assert.match(chatCss,/linear-gradient\(155deg,rgba\(130,164,211/);
assert.match(chatCss,/linear-gradient\(150deg,rgba\(32,161,190/);
assert.match(chatCss,/html\[data-theme="light"\] \.study-chat-message\.own/);
assert.match(chatCss,/body\.study-room-page\[data-room-mode="light"\]/);
assert.match(chatCss,/scrollbar-color/);

// Left floating Home Chat, including collapsed sidebar, normal + expanded.
assert.match(chatCss,/body:not\(\.study-room-page\) \.study-chat-panel:not\(\.is-expanded\)\{/);
assert.match(chatCss,/left:252px!important;right:auto!important/);
assert.match(chatCss,/\.sl-home-sidebar\.is-collapsed/);
assert.match(chatCss,/left:108px!important/);
assert.match(chatCss,/@media \(max-width:800px\)/);
assert.match(chat,/setExpanded\(!isExpanded\)/);
// Mobile Home Chat must begin below the measured floating Home header
// in both compact and expanded modes, even on narrow wrapped headers.
assert.match(chat,/mobileHomeHeader\.getBoundingClientRect\(\)\.bottom/);
assert.match(chat,/Math\.max\(82,Math\.ceil\(headerBottom\+12\)\)/);
assert.match(chat,/new ResizeObserver\(syncMobileChatHeaderOffset\)\.observe\(mobileHomeHeader\)/);
assert.match(chat,/if \(open\) \{\s*syncMobileChatHeaderOffset\(\)/);
assert.match(chatCss,/@media \(max-width:760px\)\{/);
assert.match(chatCss,/top:var\(--sl-chat-mobile-top,82px\)!important/);
assert.match(chatCss,/height:auto!important;\s*max-height:none!important;\s*min-height:0!important/);
assert.match(chatCss,/body:not\(\.study-room-page\) \.study-chat-panel:not\(\.is-expanded\)\{\s*bottom:calc\(68px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
assert.match(chatCss,/body:not\(\.study-room-page\) \.study-chat-panel\.is-expanded\{\s*bottom:calc\(8px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);

// Moderator rights are DB-enforced, never based on an editable email string.
assert.match(chat,/let isChatModerator = false/);
assert.match(chat,/client\.rpc\("studylab_chat_can_moderate"\)/);
assert.match(chat,/if\(own \|\| isChatModerator\)/);
assert.match(chat,/if\(own\) actions\.push\(\["Edit"/);
assert.match(chat,/actions\.push\(\["Delete",\(\)=>deleteMessage\(row\.id\)\]\)/);
assert.match(chat,/!isChatModerator && message\.user_id!==userId/);
assert.match(chat,/if\(!isChatModerator\)request=request\.eq\("user_id",userId\)/);
assert.match(chat,/await request\.select\("id"\)/);
assert.match(chat,/window\.confirm\(confirmation\)/);
assert.match(moderators,/studylab_private\.chat_moderators/);
assert.match(moderators,/studylab_chat_can_moderate/);
assert.match(moderators,/for delete to authenticated/);
assert.match(moderators,/studylab_private\.chat_moderation_log/);
assert.match(moderators,/studylab_chat_moderation_audit/);
assert.match(moderators,/revoke all on studylab_private\.chat_moderation_log from public, anon, authenticated/);
assert.doesNotMatch(moderators,/drop policy if exists "StudyLab chat delete own message"/i);

// Only Like + Comments appear in Social. Historical reaction data remains
// in the separate migration/table, but the frontend no longer loads it.
assert.match(social,/actions\.append\(like, commentsButton\)/);
assert.match(social,/studylab_social_likes/);
assert.match(social,/studylab_social_comments/);
assert.match(social,/sl-feed-comment-identity/);
assert.match(social,/window\.StudyLabProfileView\?\.open\(\{userId:comment\.author_id\}\)/);
assert.doesNotMatch(social,/studylab_social_post_reactions|SOCIAL_REACTIONS|sl-feed-reaction-actions|updateReactionButtons/);
assert.doesNotMatch(socialCss,/sl-feed-reaction-actions|sl-feed-reaction-button/);
assert.match(socialMigration,/create table if not exists public\.studylab_social_post_reactions/);
assert.doesNotMatch(moderators,/delete from public\.studylab_social_posts/i);

for(const html of [home,room]){
  assert.match(html,/chat\.js\?v=20261116-chat-liquid-v1/);
  assert.match(html,/chat\.css\?v=20261116-chat-liquid-v1/);
  assert.match(html,/studylab-avatar\.js\?v=20261116-manual-crop-v1/);
}
assert.match(home,/studylab-social\.js\?v=20261115-social-likes-only-v3/);
assert.match(home,/feed-drawer\.css\?v=20261115-social-likes-only-v3/);

/* PR #102 smoke checks for connected Chat, alongside legacy ownership checks. */
assert.match(chat,/imageBucket:"studylab-chat-images"/);
assert.match(chat,/maxImages:3/);
assert.match(chat,/maxImageBytes:1048576/);
assert.match(chat,/compressChatImage/);
assert.match(chat,/createSignedUrl\(path,3600\)/);
assert.match(chat,/image_paths:uploaded/);
assert.match(chat,/classList\.add\("is-entering"\)/);
assert.match(chat,/classList\.add\("is-exiting"\)/);
assert.match(chat,/closeReactionPicker\(id\)/);
assert.match(chat,/\.on\("presence",\{event:"sync"\},refreshTyping\)/);
assert.match(chat,/channel\.track/);
assert.match(chat,/data-chat-typing/);
assert.match(chat,/data-chat-image-input/);
assert.match(chatCss,/linear-gradient\(120deg,rgba\(32,160,223,\.35\),rgba\(90,91,220,\.28\)\)/);
assert.match(chatCss,/study-chat-typing-dots/);
assert.match(chatCss,/study-chat-image-gallery/);
assert.match(chatCss,/sl-chat-outgoing/);
assert.match(chatCss,/prefers-reduced-motion/);
const followCss=read("assets/css/studylab-follow.css");
assert.match(followCss,/PR #102 Chat Polish/);
assert.match(followCss,/color:#57d8f9!important/);
assert.match(followCss,/color:#164f88!important/);
assert.match(followCss,/body\.study-room-page\[data-room-theme\]/);
const imageSql=read("supabase/migrations/20261116204000_chat_image_attachments.sql");
assert.match(imageSql,/studylab_private\.chat_image_paths_valid/);
assert.match(imageSql,/studylab-chat-images/);
assert.match(imageSql,/1048576/);
assert.match(imageSql,/for insert to authenticated/);
assert.match(imageSql,/for delete to authenticated/);
for(const html of [home,room]){
  assert.match(html,/studylab-follow\.css\?v=20261116-follow-colors-v1/);
  assert.match(html,/studylab-popups\.js\?v=20261116-v14/);
}
const notices=read("assets/js/studylab-popups.js");
assert.match(notices,/path\.endsWith\("\/index\.html"\)/);
assert.match(notices,/window\.StudyLabAccount\?\.ready/);
assert.match(notices,/client\.auth\.getUser\(\)/);
console.log("Chat image upload, animated reactions, typing Presence and Follow theme checks passed.");

console.log("Curved Chat, left anchoring, verified moderator controls and Likes-only Social checks passed.");
