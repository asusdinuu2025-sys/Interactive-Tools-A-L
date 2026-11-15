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
  assert.match(html,/chat\.js\?v=20261115-telegram-corners-dates-v5/);
  assert.match(html,/chat\.css\?v=20261115-telegram-corners-dates-v5/);
  assert.match(html,/studylab-avatar\.js\?v=20261115-uuid-fixed-v5/);
}
assert.match(home,/studylab-social\.js\?v=20261115-social-likes-only-v3/);
assert.match(home,/feed-drawer\.css\?v=20261115-social-likes-only-v3/);
console.log("Curved Chat, left anchoring, verified moderator controls and Likes-only Social checks passed.");
