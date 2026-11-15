/* Post-reaction and Chat visual regression checks.
   No test writes to Supabase or alters Study Room progress. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const chat=read("assets/js/chat.js");
const chatCss=read("assets/css/chat.css");
const social=read("assets/js/studylab-social.js");
const socialCss=read("assets/css/feed-drawer.css");
const migration=read("supabase/migrations/20261115191500_social_post_emoji_reactions.sql");
const home=read("index.html");
const room=read("study-room.html");

// Chat: each sender's name remains stable for the browser session. Own
// identity stays cyan on the right, independently of sender palette.
assert.match(chat,/const senderColors = \[/);
assert.match(chat,/const senderColorIds = new Map\(\)/);
assert.match(chat,/const occupiedSenderColors = new Set\(\)/);
assert.match(chat,/const seed=uid\+"\|"\+sessionKey/);
assert.match(chat,/senderColorIds\.set\(uid,index\)/);
assert.match(chat,/if\(own\)article\.classList\.add\("own"\)/);
assert.match(chat,/--sl-chat-sender-dark/);
assert.match(chat,/--sl-chat-sender-light/);
assert.match(chat,/nameText\.title=nameText\.textContent/);
assert.match(chatCss,/\.study-chat-message-name-text\{/);
assert.match(chatCss,/text-overflow:ellipsis/);
assert.match(chatCss,/\.study-chat-message::after\{/);
assert.match(chatCss,/\.study-chat-message\.own::after\{/);
assert.match(chatCss,/\.study-chat-message\.own \.study-chat-message-name\{/);
assert.match(chatCss,/color:#52e0f0!important/);
assert.match(chatCss,/--sl-chat-sender-light/);
assert.match(chatCss,/body:not\(\.study-room-page\) \.study-chat-panel:not\(\.is-expanded\)/);
assert.match(chatCss,/width:min\(535px,calc\(100vw - 270px\)\)!important/);
assert.match(chatCss,/body:not\(\.study-room-page\) \.study-chat-panel\.is-expanded/);
assert.match(chatCss,/width:min\(825px,calc\(100vw - 284px\)\)!important/);
assert.match(chatCss,/html\[data-theme="light"\] \.study-chat-message\.own/);
assert.match(chatCss,/scrollbar-color/);
assert.match(chat,/function resizeMessageInput\(\)/);
assert.match(chat,/Math\.min\(needed,limit\)/);
assert.match(chat,/input\.style\.overflowY=needed>limit/);
assert.match(chat,/resizeMessageInput\(\);\s*updateComposer\(\)/);

// Social: add emoji reactions SEPARATELY from existing Like/Comment actions.
assert.match(social,/const SOCIAL_REACTIONS = \["👍","😂","🔥","❤️"\]/);
assert.match(social,/const reactions=make\("div","sl-feed-reaction-actions"\)/);
assert.match(social,/actions\.append\(like, commentsButton\)/);
assert.match(social,/actions\.append\(reactions\)/);
assert.match(social,/reactionButton\.dataset\.socialReaction=symbol/);
assert.match(social,/query\.update|table\.update\(\{reaction:symbol\}\)/);
assert.match(social,/table\.insert\(\{post_id:post\.id,user_id:currentUserId,reaction:symbol\}\)/);
assert.match(social,/postReactionsById\.set\(post\.id,/);
assert.match(social,/updateReactionButtons\(card,post\.id,currentUserId\)/);
assert.match(social,/client\.from\("studylab_social_post_reactions"\)/);
assert.match(social,/select\("post_id,user_id,reaction"\)\.in\("post_id",approvedIds\)/);
assert.match(social,/renderPost\(account\.client, post, user\.id, likesByPost, commentCountsByPost, signedImageUrls\)/);
assert.match(social,/client\.from\("studylab_social_likes"\)/);
assert.match(social,/const commentIdentity=make\("button","sl-feed-comment-identity"\)/);
assert.match(social,/window\.StudyLabProfileView\?\.open\(\{userId:comment\.author_id\}\)/);
assert.match(social,/commentIdentity\.append\(commentAvatar,commentNameNode\)/);
assert.match(socialCss,/\.sl-feed-reaction-actions/);
assert.match(socialCss,/\.sl-feed-reaction-button\.is-selected/);
assert.match(socialCss,/html\[data-theme="light"\] \.sl-feed-reaction-button/);
assert.match(socialCss,/\.sl-feed-comment-identity/);
assert.match(migration,/create table if not exists public\.studylab_social_post_reactions/);
assert.match(migration,/on delete cascade/);
assert.match(migration,/primary key \(post_id,user_id\)/);
assert.match(migration,/alter table public\.studylab_social_post_reactions enable row level security/);
assert.match(migration,/grant update \(reaction\) on public\.studylab_social_post_reactions/);
assert.match(migration,/user_id=\(select auth\.uid\(\)\)/);
assert.match(migration,/status='approved'/);
assert.doesNotMatch(migration,/drop table\s+public\.studylab_social_likes/i);
assert.doesNotMatch(migration,/delete from public\.studylab_social_likes/i);

for(const page of [home,room]){
  assert.match(page,/chat\.js\?v=20261115-sender-colors-v3/);
  assert.match(page,/chat\.css\?v=20261115-sender-colors-v3/);
  assert.match(page,/studylab-avatar\.js\?v=20261115-uuid-fixed-v5/);
}
assert.match(home,/studylab-social\.js\?v=20261115-social-reactions-v2/);
assert.match(home,/feed-drawer\.css\?v=20261115-social-reactions-v2/);
console.log("StudyLab Chat sender/bubble/theme and Social reactions/profile regression checks passed.");
