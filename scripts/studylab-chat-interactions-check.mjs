/* StudyLab chat PR #101 regression: no history changes, safe links,
   owner-only message mutation, profile links, 4 reactions and reply thread. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(p,"utf8");
const chat=read("assets/js/chat.js");
const css=read("assets/css/chat.css");
const migration=read("supabase/migrations/20261115182500_chat_replies_reactions_owner_controls.sql");
const hardening=read("supabase/migrations/20261115184000_chat_privilege_hardening.sql");
const home=read("index.html");
const room=read("study-room.html");

assert.doesNotMatch(chat,/class="study-chat-notice"/,
  "large redundant Chat notice must be removed");
assert.match(chat,/maxMessages: 100/);
assert.match(chat,/maxLength: 500/);
assert.match(chat,/rateLimitMs: 2500/);
assert.match(chat,/data-chat-reply-preview|data-chat-context/);
assert.match(chat,/study-chat-message-more/);
assert.match(chat,/row\.user_id===userId/);
assert.match(chat,/\.update\(\{message\}\)\.eq\("id",editingId\)\.eq\("user_id",userId\)/);
assert.match(chat,/\.delete\(\)\.eq\("id",id\)/);
assert.match(chat,/if\(!isChatModerator\)request=request\.eq\("user_id",userId\)/);
assert.match(chat,/await request\.select\("id"\)/);
assert.match(chat,/if\(own \|\| isChatModerator\)/);
assert.match(chat,/client\.rpc\("studylab_chat_can_moderate"\)/);
assert.match(chat,/values\.reply_to=replyTarget/);
assert.match(chat,/window\.StudyLabProfileView\?\.open\(\{userId:id\}\)/);
assert.match(chat,/window\.StudyLabAvatar\?\.decorate\(avatar,row\.user_id\)/);
assert.match(chat,/window\.StudyLabNameMark\?\.decorate\(name,row\.user_id\)/);
assert.match(chat,/window\.StudyLabFollow\?\.lookup\(ids\)/);
assert.match(chat,/const REACTIONS = \["👍","😂","🔥","❤️"\]/);
assert.match(chat,/query\.update\(\{reaction:symbol\}\)/);
assert.match(chat,/query\.insert\(\{message_id:id,user_id:userId,reaction:symbol\}\)/);
assert.match(chat,/\.select\("message_id,user_id,reaction"\)/);
assert.match(chat,/table:"studylab_chat_reactions"/);
assert.match(chat,/event:"\*"/);
assert.match(chat,/edited_at/);
assert.match(chat,/document\.createTextNode/);
assert.doesNotMatch(chat,/\.innerHTML\s*=\s*row\.(?:message|nickname)/);
assert.match(chat,/link\.rel="noopener noreferrer nofollow ugc"/);
assert.match(chat,/link\.href="tel:"/);
assert.match(css,/\.study-chat-message-avatar/);
assert.match(css,/\.study-chat-message-menu/);
assert.match(css,/\.study-chat-reaction\.is-chosen/);
assert.match(css,/\.study-chat-reply-quote/);
assert.match(css,/\.study-chat-context/);

assert.match(migration,/references public\.studylab_chat_messages\(id\) on delete set null/);
assert.match(migration,/references public\.studylab_chat_messages\(id\) on delete cascade/);
assert.match(migration,/references auth\.users\(id\) on delete cascade/);
assert.match(migration,/grant update \(message\)/);
assert.match(migration,/grant delete on public\.studylab_chat_messages/);
assert.match(migration,/user_id = \(select auth\.uid\(\)\)/);
assert.match(migration,/reaction in \('👍','😂','🔥','❤️'\)/);
assert.match(migration,/primary key \(message_id,user_id\)/);
assert.match(migration,/studylab_chat_mark_edited/);
assert.match(migration,/studylab_chat_reactions/);
assert.doesNotMatch(migration,/drop trigger\s+.*studylab_chat_trim_after_insert/i);
assert.doesNotMatch(migration,/drop function\s+.*cleanup_studylab_chat/i);
assert.match(hardening,/revoke truncate, trigger, references on public\.studylab_chat_messages/);
assert.match(hardening,/revoke truncate, trigger, references on public\.studylab_chat_reactions/);
assert.match(hardening,/grant update \(reaction\) on public\.studylab_chat_reactions/);

for(const page of [home,room]){
  assert.match(page,/chat\.css\?v=20261115-visible-reacted-v6/);
  assert.match(page,/chat\.js\?v=20261115-visible-reacted-v6/);
  assert.ok(page.indexOf("studylab-profile-view.js")<page.indexOf("chat.js"),
    "Chat must load after shared profile viewer");
}

/* Execute the production linkifier with a minimal DOM stand-in.
   This ensures user text stays inert and only safe URLs become anchors. */
const head=chat.indexOf("  function linkifyMessage(textValue) {");
const tail=chat.indexOf("\n  function activateProfile(",head);
assert.ok(head>=0 && tail>head,"Chat linkifier must be extractable");
const fnText=chat.slice(head,tail).trim();
const mockDocument={
  createDocumentFragment(){return {children:[],append(node){this.children.push(node)}}},
  createTextNode(text){return {type:"text",text}},
  createElement(tag){return {type:"element",tag}}
};
const linkify=Function("document","URL",fnText+"; return linkifyMessage;")(mockDocument,URL);
const fragment=linkify('Visit https://studylablk.netlify.app now. Call +94771234567. <img src=x onerror=alert(1)>');
const anchors=fragment.children.filter(n=>n.tag==="a");
assert.equal(anchors.length,2,"URL and phone should produce exactly two safe anchors");
assert.equal(anchors[0].href,"https://studylablk.netlify.app/");
assert.equal(anchors[0].target,"_blank");
assert.match(anchors[0].rel,/noopener noreferrer/);
assert.equal(anchors[1].href,"tel:+94771234567");
assert.ok(fragment.children.some(node=>node.type==="text"&&node.text.includes("<img")),
  "HTML-like text must remain a text node, never become markup");
const unsafe=linkify("javascript:alert(1) mailto:test@site.net");
assert.equal(unsafe.children.filter(n=>n.tag==="a").length,0,
  "Non-http URLs should never become navigable links");
console.log("StudyLab Chat reply, reaction, profile, permission and safe-link checks passed.");
