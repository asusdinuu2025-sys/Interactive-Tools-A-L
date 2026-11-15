/* =========================================================
   STUDY LAB — SHARED STUDY CHAT
   Realtime Supabase chat with profiles, replies, reactions and author controls.
   ========================================================= */

(function () {
  "use strict";

  const pagePath = window.location.pathname.replace(/\/+$/, "") || "/";
  const normalizedPath = pagePath.toLowerCase();
  const isHomePage = normalizedPath === "/" || normalizedPath.endsWith("/index.html");
  // Netlify may serve the same page through either /study-room.html or a clean /study-room route.
  const isStudyRoomPage = /\/study-room(?:\.html)?$/i.test(normalizedPath);
  if (!isHomePage && !isStudyRoomPage) return;

  const CONFIG = {
    supabaseUrl: "https://zpvatyxdbshjuqgtexzw.supabase.co",
    supabasePublishableKey: "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB",
    table: "studylab_chat_messages",
    maxMessages: 100,
    maxLength: 500,
    rateLimitMs: 2500
  };

  const CHAT_MARKUP = `
    <div class="study-chat" data-study-chat>
      <button
        type="button"
        class="study-chat-button"
        data-chat-button
        aria-expanded="false"
        aria-controls="studyChatPanel"
        aria-label="Open StudyLab chat"
      >
        <span class="study-chat-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.2-.65L4 20l1.65-4.15A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></svg></span>
        <span>Chat</span>
        <span class="study-chat-unread" data-chat-unread hidden aria-label="Unread messages"></span>
      </button>

      <aside
        class="study-chat-panel"
        id="studyChatPanel"
        data-chat-panel
        hidden
        aria-label="StudyLab chat"
      >
        <div class="study-chat-head">
          <div class="study-chat-title-wrap">
            <h2 class="study-chat-title">StudyLab Chat</h2>
            <div class="study-chat-meta">
              <span class="study-chat-status-dot is-offline" data-chat-status-dot aria-hidden="true"></span>
              <span data-chat-status>Connecting…</span>
            </div>
          </div>
          <div class="study-chat-head-actions">
            <button type="button" class="study-chat-expand" data-chat-expand
              aria-label="Expand chat window" aria-pressed="false" title="Expand chat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>
              </svg>
            </button>
            <button type="button" class="study-chat-close" data-chat-close aria-label="Close chat">×</button>
          </div>
        </div>

        <div class="study-chat-list" data-chat-list aria-live="polite"></div>

        <form class="study-chat-compose" data-chat-form>
          <div class="study-chat-context" data-chat-context hidden>
            <span data-chat-context-text></span>
            <button type="button" data-chat-context-cancel aria-label="Cancel reply or edit">×</button>
          </div>
          <div class="study-chat-feedback" data-chat-feedback role="status" hidden></div>
          <div class="study-chat-input-wrap">
            <textarea
              class="study-chat-input"
              data-chat-input
              rows="1"
              maxlength="500"
              autocomplete="off"
              spellcheck="true"
              aria-label="Type a study-related message"
            ></textarea>
            <span class="study-chat-watermark">Educational purposes only • Keep it study-related</span>
          </div>
          <button type="submit" class="study-chat-send" data-chat-send disabled aria-label="Send message">➤</button>
          <span class="study-chat-compose-meta" data-chat-count>0/500</span>
        </form>
      </aside>
    </div>
  `;

  if (!document.querySelector("[data-study-chat]")) {
    document.body.insertAdjacentHTML("beforeend", CHAT_MARKUP);
  }

  const root = document.querySelector("[data-study-chat]");
  if (!root) return;

  const button = root.querySelector("[data-chat-button]");
  const panel = root.querySelector("[data-chat-panel]");
  const closeButton = root.querySelector("[data-chat-close]");
  const expandButton = root.querySelector("[data-chat-expand]");
  const list = root.querySelector("[data-chat-list]");
  const form = root.querySelector("[data-chat-form]");
  const input = root.querySelector("[data-chat-input]");
  const sendButton = root.querySelector("[data-chat-send]");
  const charCount = root.querySelector("[data-chat-count]");
  const statusDot = root.querySelector("[data-chat-status-dot]");
  const statusText = root.querySelector("[data-chat-status]");
  const unread = root.querySelector("[data-chat-unread]");
  const inputWrap = root.querySelector(".study-chat-input-wrap");
  const contextBar = root.querySelector("[data-chat-context]");
  const contextText = root.querySelector("[data-chat-context-text]");
  const cancelContext = root.querySelector("[data-chat-context-cancel]");
  const feedback = root.querySelector("[data-chat-feedback]");

  const sessionKey =
    sessionStorage.getItem("studylab_chat_session") ||
    (window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : "guest-" + Date.now() + "-" + Math.random().toString(36).slice(2));

  sessionStorage.setItem("studylab_chat_session", sessionKey);

  let client = null;
  let userId = null;
  let nickname = "Student";
  let channel = null;
  let isOpen = false;
  let isExpanded = false;
  let unreadCount = 0;
  let lastSentAt = 0;
  let messagesById = new Map();
  let profilesById = new Map();
  let reactionsByMessage = new Map();
  let replyTarget = null;
  let editTarget = null;
  let busyMessageAction = false;
  let reactionSyncTimer = 0;
  const reactionRefreshIds = new Set();
  const REACTIONS = ["👍","😂","🔥","❤️"];
  // Each student keeps a recognizable color for the current browser session.
  // Names are colored, not whole incoming bubbles; your own name stays cyan.
  const senderColors = [
    ["#e7b2ff","#753ca7"],["#ffc47c","#925319"],["#8ce8ba","#23784c"],
    ["#ffacbf","#a7375b"],["#a6bbff","#445db4"],["#f8e08b","#86600b"],
    ["#91dcea","#126b86"],["#ebabe4","#913f88"],["#b6e58e","#517e1d"],
    ["#fcb4a2","#9e4a35"],["#b5b4ff","#6554a1"],["#a3e6d8","#206e67"]
  ];
  const senderColorIds = new Map();
  const occupiedSenderColors = new Set();
  function senderColor(uid){
    if(!uid) return senderColors[0];
    if(senderColorIds.has(uid)) return senderColors[senderColorIds.get(uid)];
    let hash=2166136261;
    const seed=uid+"|"+sessionKey;
    for(let i=0;i<seed.length;i++){
      hash^=seed.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    let index=(hash>>>0)%senderColors.length;
    for(let tries=0;tries<senderColors.length && occupiedSenderColors.has(index);tries++){
      index=(index+1)%senderColors.length;
    }
    senderColorIds.set(uid,index);
    occupiedSenderColors.add(index);
    return senderColors[index];
  }
  function resizeMessageInput(){
    if(!input)return;
    input.style.height="auto";
    const limit=99; // about 4 lines at the current font size
    const needed=Math.max(43,input.scrollHeight);
    input.style.height=Math.min(needed,limit)+"px";
    input.style.overflowY=needed>limit?"auto":"hidden";
  }
  const safeUuid = value => typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

  async function loadChatIdentity() {
    const account = window.StudyLabAccount;
    if (!account?.ready) throw new Error("StudyLab account unavailable.");

    await account.ready;

    const user = account.getUser?.();
    if (!user?.id) throw new Error("StudyLab student account unavailable.");

    userId = user.id;

    const profile = await account.getProfile?.();
    if (profile?.display_name) {
      nickname = profile.display_name;
    } else {
      const nicknameNumber = Array.from(userId)
        .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9000 + 1000;
      nickname = "Student " + nicknameNumber;
    }
  }

  window.addEventListener("studylab-profile-updated", event => {
    const name = event.detail?.display_name;
    if (name) nickname = name;
    if(userId){
      profilesById.delete(userId);
      loadProfiles();
    }
  });

  function setStatus(online, textValue) {
    statusDot?.classList.toggle("is-offline", !online);
    if (statusText) statusText.textContent = textValue;
  }

  function setUnread(count) {
    const numericCount = Number(count);
    unreadCount = Number.isFinite(numericCount)
      ? Math.max(0, Math.floor(numericCount))
      : 0;

    if (!unread) return;

    if (unreadCount === 0) {
      unread.textContent = "";
      unread.hidden = true;
      unread.removeAttribute("aria-label");
      return;
    }

    unread.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    unread.setAttribute(
      "aria-label",
      unreadCount === 1 ? "1 unread message" : unreadCount + " unread messages"
    );
    unread.hidden = false;
  }

  function scrollToBottom(force = false) {
    if (!list) return;
    const distance =
      list.scrollHeight - list.scrollTop - list.clientHeight;

    if (force || distance < 120) {
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });
    }
  }

  function clearEmptyState() {
    const empty = list?.querySelector(".study-chat-empty");
    empty?.remove();
  }

  function chatFeedback(text, isError = false) {
    if (!feedback) return;
    feedback.hidden = !text;
    feedback.textContent = text || "";
    feedback.classList.toggle("is-error", Boolean(isError));
  }

  function showComposerContext() {
    if (!contextBar) return;
    const active=editTarget||replyTarget;
    contextBar.hidden=!active;
    if(contextText){
      const row=messagesById.get(active);
      contextText.textContent=editTarget
        ? "Editing your message"
        : "Replying to " + (row?.nickname || "a student") + ": " +
          String(row?.message || "").slice(0,90);
    }
    input.placeholder=editTarget?"Edit your message…":replyTarget?"Write a reply…":"";
    resizeMessageInput();
    updateComposer();
  }
  function clearComposerContext(clearInput = false) {
    editTarget=null;replyTarget=null;
    if(clearInput)input.value="";
    resizeMessageInput();
    showComposerContext();
  }

  // Render link and phone anchors as DOM nodes only. Never insert message
  // content as HTML; malicious markup must remain inert text.
  function linkifyMessage(textValue) {
    const fragment=document.createDocumentFragment();
    const raw=String(textValue||"");
    const pattern=/(?:https?:\/\/|www\.)[^\s<>"']+|(?:\+?\d[\d().\s-]{7,}\d)/gi;
    let pos=0;
    for(const match of raw.matchAll(pattern)){
      const index=match.index;
      if(index < pos)continue;
      if(index>pos)fragment.append(document.createTextNode(raw.slice(pos,index)));
      const matched=match[0];
      let candidate=matched;
      let suffix="";
      if(/^(?:https?:\/\/|www\.)/i.test(candidate)){
        candidate=candidate.replace(/[.,;!?]+$/g,m=>{suffix=m+suffix;return "";});
        if(candidate.endsWith(")") &&
          (candidate.match(/\(/g)||[]).length < (candidate.match(/\)/g)||[]).length){
          candidate=candidate.slice(0,-1);suffix=")"+suffix;
        }
        try {
          const parsed=new URL(candidate.startsWith("www.")?"https://"+candidate:candidate);
          if(["http:","https:"].includes(parsed.protocol)){
            const link=document.createElement("a");
            link.textContent=candidate;link.href=parsed.href;
            link.target="_blank";link.rel="noopener noreferrer nofollow ugc";
            fragment.append(link);
          }else fragment.append(document.createTextNode(candidate));
        }catch(_){fragment.append(document.createTextNode(candidate));}
      }else{
        const digits=candidate.replace(/\D/g,"");
        const atStart=index===0 || !/[\w@]/.test(raw[index-1]);
        if(atStart && digits.length>=9 && digits.length<=15 &&
          /^(\+|0)/.test(candidate.trim())){
          const link=document.createElement("a");
          link.textContent=candidate;
          link.href="tel:"+(candidate.trim().startsWith("+")?"+":"")+digits;
          fragment.append(link);
        }else fragment.append(document.createTextNode(candidate));
      }
      if(suffix)fragment.append(document.createTextNode(suffix));
      pos=index+matched.length;
    }
    if(pos<raw.length)fragment.append(document.createTextNode(raw.slice(pos)));
    return fragment;
  }

  function activateProfile(id) {
    if (!safeUuid(id))return;
    window.StudyLabProfileView?.open({userId:id});
  }

  function messageReactions(id, container) {
    const rows=reactionsByMessage.get(id)||[];
    container.replaceChildren();
    for(const symbol of REACTIONS){
      const used=rows.filter(item=>item.reaction===symbol);
      const chosen=used.some(item=>item.user_id===userId);
      const reaction=document.createElement("button");
      reaction.type="button";reaction.className="study-chat-reaction";
      reaction.classList.toggle("is-chosen",chosen);
      reaction.setAttribute("aria-pressed",String(chosen));
      reaction.setAttribute("aria-label",symbol+" reaction, "+used.length+" students");
      reaction.append(document.createTextNode(symbol));
      if(used.length){
        const counter=document.createElement("span");
        counter.textContent=String(used.length);reaction.append(counter);
      }
      reaction.addEventListener("click",()=>toggleReaction(id,symbol));
      container.append(reaction);
    }
  }
  function refreshReactionUI() {
    for(const article of list.querySelectorAll(".study-chat-message")){
      const id=article.dataset.messageId;
      const reactions=article.querySelector(".study-chat-reactions");
      if(id && reactions)messageReactions(id,reactions);
    }
  }

  function renderMessage(row) {
    if (!list || !row?.id) return;
    const existing=[...list.querySelectorAll(".study-chat-message")]
      .find(node=>node.dataset.messageId===row.id);
    messagesById.set(row.id,row);
    clearEmptyState();

    const article=existing||document.createElement("article");
    article.className="study-chat-message";
    article.dataset.messageId=row.id;
    const own=Boolean(row.user_id && row.user_id===userId);
    if(own)article.classList.add("own");
    else{
      const [dark,light]=senderColor(row.user_id||row.nickname||row.session_id);
      article.style.setProperty("--sl-chat-sender-dark",dark);
      article.style.setProperty("--sl-chat-sender-light",light);
    }

    const header=document.createElement("div");
    header.className="study-chat-message-head";
    const identity=document.createElement(safeUuid(row.user_id)?"button":"div");
    identity.className="study-chat-message-author";
    if(identity.tagName==="BUTTON"){
      identity.type="button";
      identity.title="View student profile";
      identity.addEventListener("click",()=>activateProfile(row.user_id));
    }
    const avatar=document.createElement("span");
    avatar.className="study-chat-message-avatar";
    const profile=profilesById.get(row.user_id);
    const isFemale=profile?.gender==="female";
    avatar.classList.toggle("female",isFemale);
    avatar.innerHTML=isFemale
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"/><path d="M7 20l1-4.2a4.1 4.1 0 0 1 8 0l1 4.2z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"/><path d="M4.5 20v-2.5a7.5 7.5 0 0 1 15 0V20z"/></svg>';
    if(safeUuid(row.user_id))window.StudyLabAvatar?.decorate(avatar,row.user_id);
    const name=document.createElement("span");
    name.className="study-chat-message-name";
    const nameText=document.createElement("span");
    nameText.className="study-chat-message-name-text";
    nameText.textContent=profile?.display_name||row.nickname||"Student";
    nameText.title=nameText.textContent; // Full name remains available if truncated.
    name.append(nameText);
    if(safeUuid(row.user_id))window.StudyLabNameMark?.decorate(name,row.user_id);
    identity.append(avatar,name);header.append(identity);

    if(own){
      const menuWrap=document.createElement("div");
      menuWrap.className="study-chat-message-menu-wrap";
      const dots=document.createElement("button");
      dots.type="button";dots.className="study-chat-message-more";
      dots.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
      dots.title="Message options";
      dots.setAttribute("aria-label","Message options");
      dots.setAttribute("aria-expanded","false");
      const menu=document.createElement("div");
      menu.className="study-chat-message-menu";menu.hidden=true;
      for(const [label,handler] of [
        ["Edit",()=>{
          replyTarget=null;editTarget=row.id;
          input.value=row.message||"";
          showComposerContext();input.focus();
          chatFeedback("");
        }],
        ["Delete",()=>deleteMessage(row.id)]
      ]){
        const option=document.createElement("button");
        option.type="button";
        option.className=label==="Delete"?"study-chat-option-delete":"study-chat-option-edit";
        const iconSvg=document.createElementNS("http://www.w3.org/2000/svg","svg");
        iconSvg.setAttribute("viewBox","0 0 24 24");
        iconSvg.setAttribute("fill","none");
        iconSvg.setAttribute("stroke","currentColor");
        iconSvg.setAttribute("stroke-width","1.9");
        iconSvg.setAttribute("stroke-linecap","round");
        iconSvg.setAttribute("stroke-linejoin","round");
        iconSvg.setAttribute("aria-hidden","true");
        const iconPath=document.createElementNS("http://www.w3.org/2000/svg","path");
        iconPath.setAttribute("d",label==="Delete"
          ?"M4 7h16M10 4h4m-7 3 1 13h8l1-13M10 11v6m4-6v6"
          :"M4 20h4l11-11a2.5 2.5 0 0 0-4-4L4 16v4Zm9-13 4 4");
        iconSvg.append(iconPath);
        option.append(iconSvg,document.createTextNode(label));
        option.addEventListener("click",event=>{
          event.stopPropagation();menu.hidden=true;dots.setAttribute("aria-expanded","false");
          handler();
        });
        menu.append(option);
      }
      dots.addEventListener("click",event=>{
        event.stopPropagation();
        for(const open of document.querySelectorAll(".study-chat-message-menu:not([hidden])"))open.hidden=true;
        const isOpening=menu.hidden;
        menu.hidden=!isOpening;dots.setAttribute("aria-expanded",String(isOpening));
      });
      menuWrap.append(dots,menu);header.append(menuWrap);
    }

    const body=document.createElement("div");
    body.className="study-chat-message-text";
    if(row.reply_to){
      const quote=document.createElement("button");
      quote.type="button";quote.className="study-chat-reply-quote";
      const source=messagesById.get(row.reply_to);
      quote.textContent=source
        ? "↳ "+source.nickname+": "+String(source.message||"").slice(0,76)
        : "↳ Previous message unavailable";
      quote.addEventListener("click",()=>{
        const target=[...list.querySelectorAll(".study-chat-message")]
          .find(el=>el.dataset.messageId===row.reply_to);
        target?.scrollIntoView({behavior:"smooth",block:"nearest"});
        target?.classList.add("is-highlighted");
        if(target)setTimeout(()=>target.classList.remove("is-highlighted"),1350);
      });
      body.append(quote);
    }
    const text=document.createElement("span");
    text.className="study-chat-message-content";
    text.append(linkifyMessage(row.message));
    body.append(text);

    const reactions=document.createElement("div");
    reactions.className="study-chat-reactions";
    messageReactions(row.id,reactions);
    const footer=document.createElement("div");
    footer.className="study-chat-message-foot";
    const reply=document.createElement("button");
    reply.type="button";reply.className="study-chat-message-reply";
    reply.textContent="↩ Reply";
    reply.addEventListener("click",()=>{
      if(editTarget)input.value="";
      editTarget=null;replyTarget=row.id;
      showComposerContext();input.focus();chatFeedback("");
    });
    const timestamp=document.createElement("span");
    timestamp.className="study-chat-message-time";
    timestamp.textContent=formatTime(row.created_at)+(row.edited_at?" · edited":"");
    footer.append(reply,timestamp);
    article.replaceChildren(header,body,reactions,footer);

    if(!existing)list.appendChild(article);
    while(list.querySelectorAll(".study-chat-message").length>CONFIG.maxMessages){
      const oldest=list.querySelector(".study-chat-message");
      if(oldest){
        messagesById.delete(oldest.dataset.messageId);
        reactionsByMessage.delete(oldest.dataset.messageId);
        oldest.remove();
      }
    }
  }

  async function loadProfiles() {
    const ids=[...new Set([...messagesById.values()]
      .map(row=>row.user_id).filter(safeUuid))];
    if(!ids.length)return;
    const missing=ids.filter(id=>!profilesById.has(id));
    try {
      if(missing.length){
        const batches=[];
        for(let i=0;i<missing.length;i+=40)batches.push(missing.slice(i,i+40));
        const results=await Promise.all(batches.map(ids=>window.StudyLabFollow?.lookup(ids)||[]));
        const byId=new Map(results.flat().filter(p=>p?.user_id).map(p=>[p.user_id,p]));
        for(const id of missing)profilesById.set(id,byId.get(id)||{user_id:id});
        for(const row of [...messagesById.values()]){
          if(missing.includes(row.user_id))renderMessage(row);
        }
      }
      // StudyLabAvatar internally caches photos for 90 seconds, so this never
      // re-fetches existing avatars on every new message.
      await window.StudyLabAvatar?.prefetch(ids).catch(()=>{});
    }catch(error){console.warn("Chat profile labels unavailable:",error);}
  }

  async function loadReactions(onlyIds) {
    if(!client || !messagesById.size)return;
    const ids=(onlyIds||[...messagesById.keys()])
      .filter(id=>messagesById.has(id));
    if(!ids.length)return;
    const {data,error}=await client.from("studylab_chat_reactions")
      .select("message_id,user_id,reaction").in("message_id",ids);
    if(error){console.warn("Chat reactions unavailable:",error);return;}
    const next=new Map();
    for(const item of data||[]){
      if(!next.has(item.message_id))next.set(item.message_id,[]);
      next.get(item.message_id).push(item);
    }
    if(!onlyIds)reactionsByMessage=next;
    else for(const id of ids)reactionsByMessage.set(id,next.get(id)||[]);
    refreshReactionUI();
  }

  async function toggleReaction(id,symbol) {
    if(!client||!userId||!REACTIONS.includes(symbol)||!messagesById.has(id))return;
    const active=(reactionsByMessage.get(id)||[]).find(r=>r.user_id===userId);
    const query=client.from("studylab_chat_reactions");
    // Insert a new reaction, update ONLY its emoji when switching, or delete
    // it when tapped twice. Column-level grants forbid changing owner/target.
    let result;
    if(active?.reaction===symbol){
      result=await query.delete().eq("message_id",id).eq("user_id",userId);
    }else if(active){
      result=await query.update({reaction:symbol})
        .eq("message_id",id).eq("user_id",userId);
    }else{
      result=await query.insert({message_id:id,user_id:userId,reaction:symbol});
    }
    const {error}=result;
    if(error){chatFeedback("Reaction failed. Please try again.",true);return;}
    chatFeedback("");await loadReactions([id]);
  }

  async function deleteMessage(id) {
    if(!client||!userId||messagesById.get(id)?.user_id!==userId)return;
    if(!window.confirm("Delete your message? This cannot be undone."))return;
    const {error}=await client.from(CONFIG.table).delete()
      .eq("id",id).eq("user_id",userId);
    if(error){chatFeedback("Could not delete message.",true);return;}
    deleteMessageLocally(id);
  }
  function deleteMessageLocally(id) {
    messagesById.delete(id);reactionsByMessage.delete(id);
    for(const element of list.querySelectorAll(".study-chat-message")){
      if(element.dataset.messageId===id)element.remove();
    }
    if(editTarget===id||replyTarget===id)clearComposerContext();
    if(messagesById.size===0)renderInitial([]);
    else for(const row of [...messagesById.values()]){
      if(row.reply_to===id)renderMessage({...row,reply_to:null});
    }
  }

  function renderInitial(rows) {
    if (!list) return;
    list.innerHTML = "";
    messagesById = new Map();

    if (!rows?.length) {
      const empty = document.createElement("div");
      empty.className = "study-chat-empty";
      empty.textContent = "No messages yet. Start a study-related conversation.";
      list.appendChild(empty);
      return;
    }

    rows.slice(-CONFIG.maxMessages).forEach(renderMessage);
    scrollToBottom(true);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function updateComposer() {
    const length = input?.value.length || 0;
    if (charCount) charCount.textContent = length + "/" + CONFIG.maxLength;
    inputWrap?.classList.toggle("has-text", length > 0);
    if (sendButton) {
      sendButton.disabled =
        !length ||
        length > CONFIG.maxLength ||
        !client ||
        busyMessageAction ||
        (!editTarget && Date.now() - lastSentAt < CONFIG.rateLimitMs);
    }
  }

  function showSetupState() {
    if (!list) return;
    list.innerHTML = `
      <div class="study-chat-setup">
        <strong>Chat is being prepared</strong>
        Run <code>supabase/studylab_backend_setup.sql</code> once in your Supabase SQL Editor, with Anonymous Sign-Ins enabled, then refresh this page.
      </div>
    `;
  }

  async function loadMessages() {
    if (!client) return;

    const { data, error } = await client
      .from(CONFIG.table)
      .select("id,message,created_at,session_id,user_id,nickname,reply_to,edited_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CONFIG.maxMessages);

    if (error) {
      console.warn("StudyLab Chat load:", error);
      setStatus(false, "Chat setup required");
      showSetupState();
      return;
    }

    renderInitial((data || []).reverse());
    // Separate, read-only student identity lookup: never expose private
    // student profile fields or require individual profile queries per bubble.
    loadProfiles();
    loadReactions();
  }

  function subscribe() {
    if (!client) return;

    channel = client
      .channel("studylab-chat-room")
      .on("postgres_changes",
        {event:"*",schema:"public",table:CONFIG.table},
        payload=>{
          if(payload.eventType==="DELETE"){
            deleteMessageLocally(payload.old?.id);
            return;
          }
          const row=payload.new;
          if(!row?.id)return;
          const wasKnown=messagesById.has(row.id);
          const wasNearBottom=list &&
            list.scrollHeight-list.scrollTop-list.clientHeight<140;
          renderMessage(row);
          if(payload.eventType==="INSERT"){
            if(!isOpen && row.user_id!==userId)setUnread(unreadCount+1);
            if(wasNearBottom || row.session_id===sessionKey)scrollToBottom(true);
            loadProfiles();
          } else if(wasKnown){
            // Keep edits across every open tab without reordering messages.
            loadProfiles();
          }
        })
      .on("postgres_changes",
        {event:"*",schema:"public",table:"studylab_chat_reactions"},
        payload=>{
          const id=payload.new?.message_id || payload.old?.message_id;
          if(id)reactionRefreshIds.add(id);
          clearTimeout(reactionSyncTimer);
          reactionSyncTimer=setTimeout(()=>{
            const changed=[...reactionRefreshIds];
            reactionRefreshIds.clear();
            loadReactions(changed.length?changed:undefined);
          },140);
        })
      .subscribe(status=>{
        if(status==="SUBSCRIBED")setStatus(true,"Live • newest 100 messages");
        else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")
          setStatus(false,"Live connection unavailable");
      });
  }

  async function sendMessage() {
    if(!client || !input || busyMessageAction)return;
    const message=input.value.trim();
    if(!message || message.length>CONFIG.maxLength){updateComposer();return;}
    const now=Date.now();
    if(!editTarget && now-lastSentAt<CONFIG.rateLimitMs)return;
    busyMessageAction=true;
    if(!editTarget)lastSentAt=now;
    updateComposer();chatFeedback("");
    try {
      const editingId=editTarget;
      let error;
      if(editingId){
        if(messagesById.get(editingId)?.user_id!==userId)
          throw new Error("Only the author can edit this message.");
        ({error}=await client.from(CONFIG.table)
          .update({message}).eq("id",editingId).eq("user_id",userId));
      }else{
        const values={message,session_id:sessionKey,user_id:userId,nickname};
        if(replyTarget && messagesById.has(replyTarget))values.reply_to=replyTarget;
        ({error}=await client.from(CONFIG.table).insert(values));
      }
      if(error)throw error;
      input.value="";clearComposerContext();resizeMessageInput();updateComposer();
    }catch(error){
      console.warn("StudyLab Chat message action:",error);
      chatFeedback(error?.message?.includes("foreign key")
        ?"That original message is no longer available. Cancel reply and send again."
        :editTarget?"Could not edit message.":"Message could not be sent.",true);
      if(!editTarget)lastSentAt=0;
    }finally{
      busyMessageAction=false;
      updateComposer();
      window.setTimeout(updateComposer,CONFIG.rateLimitMs+20);
    }
  }

  function closeQuickAccess() {
    const quickPanel = document.getElementById("studyQuickAccessPanel");
    const quickButton = document.getElementById("studyQuickButton");
    if (quickPanel && !quickPanel.hidden) {
      quickPanel.hidden = true;
      quickButton?.setAttribute("aria-expanded", "false");
      quickButton?.classList.remove("is-open");
    }
  }

  function setExpanded(expanded){
    isExpanded=Boolean(expanded);
    panel.classList.toggle("is-expanded",isExpanded);
    expandButton?.setAttribute("aria-pressed",String(isExpanded));
    expandButton?.setAttribute("aria-label",isExpanded?"Restore chat window":"Expand chat window");
    expandButton.title=isExpanded?"Restore chat size":"Expand chat";
    if(isOpen){
      resizeMessageInput();
      scrollToBottom();
    }
  }

  function setOpen(open) {
    isOpen = open;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.classList.toggle("is-open", open);

    if (open) {
      window.dispatchEvent(new Event("studylab-chat-open"));
      closeQuickAccess();
      setUnread(0);
      scrollToBottom(true);
      resizeMessageInput();
      input?.focus();
    }
  }

  function setupUI() {
    button?.addEventListener("click", event => {
      event.stopPropagation();
      setOpen(!isOpen);
    });

    closeButton?.addEventListener("click", () => setOpen(false));
    expandButton?.addEventListener("click",()=>setExpanded(!isExpanded));

    panel?.addEventListener("click", event => event.stopPropagation());

    form?.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage();
    });

    input?.addEventListener("input",()=>{
      chatFeedback("");
      resizeMessageInput();
      updateComposer();
    });
    cancelContext?.addEventListener("click",()=>clearComposerContext(true));
    // The menu belongs to its message, and closes on outside click.
    panel?.addEventListener("click",event=>{
      if(event.target.closest(".study-chat-message-more,.study-chat-message-menu"))return;
      for(const menu of panel.querySelectorAll(".study-chat-message-menu:not([hidden])")){
        menu.hidden=true;
        menu.parentElement?.querySelector(".study-chat-message-more")
          ?.setAttribute("aria-expanded","false");
      }
    });

    input?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    document.addEventListener("click", event => {
      if (
        isOpen &&
        panel &&
        !panel.contains(event.target) &&
        event.target !== button &&
        !button.contains(event.target)
      ) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && isOpen) {
        const visibleMenu=panel?.querySelector(".study-chat-message-menu:not([hidden])");
        if(visibleMenu){
          visibleMenu.hidden=true;
          visibleMenu.parentElement?.querySelector(".study-chat-message-more")
            ?.setAttribute("aria-expanded","false");
        }else if(replyTarget||editTarget)clearComposerContext(true);
        else setOpen(false);
      }
    });

    window.addEventListener("studylab-quick-open", () => {
      if (isOpen) setOpen(false);
    });

    window.addEventListener("studylab-feedback-open", () => {
      if (isOpen) setOpen(false);
    });

    updateComposer();
  }

  async function boot() {
    setupUI();

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      setStatus(false, "Chat library unavailable");
      showSetupState();
      return;
    }

    try {
      await loadChatIdentity();

      client = window.StudyLabAccount?.client || window.supabase.createClient(
        CONFIG.supabaseUrl,
        CONFIG.supabasePublishableKey
      );

      await loadMessages();
      subscribe();

    } catch (error) {
      console.warn("StudyLab Chat:", error);
      setStatus(false, "Chat connection unavailable");
      showSetupState();
    }

    updateComposer();
  }

  boot();
})();
