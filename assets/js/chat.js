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
    rateLimitMs: 2500,
    imageBucket:"studylab-chat-images",
    fileBucket:"studylab-chat-files",
    maxImages:3,
    maxImageBytes:1048576,
    maxSourceBytes:12*1048576,
    maxFiles:2,
    maxFileBytes:5*1048576
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
        <div class="study-chat-typing" data-chat-typing hidden aria-live="polite">
          <span class="study-chat-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span data-chat-typing-label>Typing…</span>
        </div>

        <form class="study-chat-compose" data-chat-form>
          <div class="study-chat-context" data-chat-context hidden>
            <span data-chat-context-text></span>
            <button type="button" data-chat-context-cancel aria-label="Cancel reply or edit">×</button>
          </div>
          <div class="study-chat-feedback" data-chat-feedback role="status" hidden></div>
          <div class="study-chat-attachment-preview" data-chat-attachment-preview hidden></div>
          <input type="file" data-chat-image-input accept="image/jpeg,image/png,image/webp" multiple hidden aria-label="Attach up to three images" />
          <input type="file" data-chat-file-input accept=".pdf,.docx,.pptx,.txt" multiple hidden aria-label="Attach up to two study documents, 5 MB each" />
          <div class="study-chat-editorline">
            <button type="button" class="study-chat-attachments-toggle"
              data-chat-attachments-toggle aria-label="Add photo or document"
              aria-expanded="false" aria-haspopup="true" title="Attach">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 12.5 14.4 6a3.4 3.4 0 0 1 4.8 4.8l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6"/>
              </svg>
            </button>
            <div class="study-chat-attachment-menu" data-chat-attachment-menu hidden>
              <button type="button" class="study-chat-attach" data-chat-attach
                aria-label="Attach images" title="Add up to three images">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3"/>
                  <path d="m4 17 5-5 3 3 3-4 5 6"/>
                </svg><span>Image</span>
              </button>
              <button type="button" class="study-chat-file-attach" data-chat-file-attach
                aria-label="Attach study documents" title="PDF, DOCX, PPTX or TXT · 5 MB each" disabled>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <path d="M14 2v6h6M8 13h8M8 17h8"/>
                </svg><span>File</span>
              </button>
            </div>
            <div class="study-chat-input-wrap">
              <textarea class="study-chat-input" data-chat-input rows="1" maxlength="500"
                autocomplete="off" spellcheck="true" placeholder="Message…"
                aria-label="Type a study-related message"></textarea>
              <span class="study-chat-watermark">Educational purposes only • Keep it study-related</span>
            </div>
            <button type="submit" class="study-chat-send" data-chat-send disabled aria-label="Send message" title="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/>
              </svg>
            </button>
            <span class="study-chat-compose-meta" data-chat-count>0/500</span>
          </div>
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
  // The fixed Home top bar can wrap on narrow phones. Measure its actual
  // bottom edge so the Chat title never sits behind the header.
  const mobileHomeHeader = isHomePage ? document.querySelector("header.site-header") : null;
  function syncMobileChatHeaderOffset(){
    if(!mobileHomeHeader || window.innerWidth>760)return;
    const headerBottom = mobileHomeHeader.getBoundingClientRect().bottom;
    panel.style.setProperty("--sl-chat-mobile-top", Math.max(82,Math.ceil(headerBottom+12))+"px");
  }
  if(mobileHomeHeader){
    syncMobileChatHeaderOffset();
    window.addEventListener("resize",syncMobileChatHeaderOffset,{passive:true});
    if(typeof ResizeObserver!=="undefined"){
      new ResizeObserver(syncMobileChatHeaderOffset).observe(mobileHomeHeader);
    }
  }
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
  const typingBar = root.querySelector("[data-chat-typing]");
  const typingLabel = root.querySelector("[data-chat-typing-label]");
  const imageInput = root.querySelector("[data-chat-image-input]");
  const fileInput = root.querySelector("[data-chat-file-input]");
  const attachButton = root.querySelector("[data-chat-attach]");
  const fileButton = root.querySelector("[data-chat-file-attach]");
  const attachmentsToggle = root.querySelector("[data-chat-attachments-toggle]");
  const attachmentsMenu = root.querySelector("[data-chat-attachment-menu]");
  let attachmentMenuClosing = 0;
  function setAttachmentMenu(open) {
    if (!attachmentsMenu || !attachmentsToggle) return;
    clearTimeout(attachmentMenuClosing);
    if (open) {
      if (attachmentsToggle.disabled) return;
      attachmentsMenu.hidden = false;
      // Next paint animates a lightweight two-choice panel.
      requestAnimationFrame(()=>{
        if(!attachmentsMenu.hidden &&
           attachmentsToggle.getAttribute("aria-expanded")==="true")
          attachmentsMenu.classList.add("is-open");
      });
    } else {
      attachmentsMenu.classList.remove("is-open");
      attachmentMenuClosing = window.setTimeout(()=>{
        if (!attachmentsMenu.classList.contains("is-open")) attachmentsMenu.hidden = true;
      },180);
    }
    attachmentsToggle.setAttribute("aria-expanded",String(open));
  }
  const attachPreview = root.querySelector("[data-chat-attachment-preview]");
  let pendingImages = [];
  let pendingFiles = [];
  let fileSharingAvailable = false;
  const chatMessageColumns = "id,message,created_at,session_id,user_id,nickname,reply_to,edited_at,image_paths";
  const selectMessageColumns = () => chatMessageColumns +
    (fileSharingAvailable ? ",file_attachments" : "");
  let typingIdleTimer=0,lastTypingSent=0,channelSubscribed=false,typingActive=false;
  const imageUrlCache = new Map();
  const fileUrlCache = new Map();

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
  let reconnectTimer = 0;
  let reconnectAttempts = 0;
  let reconnecting = false;
  let syncingMessages = false;
  let syncRequested = false;
  let lastChatSyncAt = 0;
  let messageEventSeq = 0;
  let isOpen = false;
  let isExpanded = false;
  let isChatModerator = false;
  let unreadCount = 0;
  let lastSentAt = 0;
  let messagesById = new Map();
  let profilesById = new Map();
  let reactionsByMessage = new Map();
  let replyTarget = null;
  let editTarget = null;
  let busyMessageAction = false;
  let instantChatMode=true, queueRunning=false, lastQueueWrite=0;
  const pendingTextQueue=[], pendingTextCards=new Map();
  const pendingTextHost=document.createElement("div");
  pendingTextHost.className="study-chat-pending-text-host";
  pendingTextHost.setAttribute("aria-label","Your pending messages");
  const MAX_TEXT_QUEUE=4;
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

  function closeReactionPicker(id){
    const node=[...list.querySelectorAll(".study-chat-message")].find(x=>x.dataset.messageId===id);
    if(!node)return;
    node.classList.remove("is-reactions-open");
    const toggle=node.querySelector(".study-chat-react-toggle");
    if(toggle){toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","Show reactions to this message");}
  }
  function messageReactions(id, container, usedOnly = false) {
    const rows=reactionsByMessage.get(id)||[];
    container.replaceChildren();
    for(const symbol of REACTIONS){
      const used=rows.filter(item=>item.reaction===symbol);
      if(usedOnly && !used.length)continue;
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
      reaction.addEventListener("click",()=>{
        closeReactionPicker(id);
        toggleReaction(id,symbol);
      });
      container.append(reaction);
    }
  }
  function refreshReactionUI() {
    for(const article of list.querySelectorAll(".study-chat-message")){
      const id=article.dataset.messageId;
      const usedReactions=article.querySelector(".study-chat-reactions-used");
      const reactions=article.querySelector(".study-chat-reactions");
      if(id && usedReactions)messageReactions(id,usedReactions,true);
      if(id && reactions)messageReactions(id,reactions);
    }
  }

  function renderMessage(row,animate=false) {
    if (!list || !row?.id) return;
    const existing=[...list.querySelectorAll(".study-chat-message")]
      .find(node=>node.dataset.messageId===row.id);
    messagesById.set(row.id,row);
    clearEmptyState();

    const article=existing||document.createElement("article");
    const reactionsWereOpen=existing?.classList.contains("is-reactions-open")||false;
    article.className="study-chat-message";
    article.classList.toggle("is-reactions-open",reactionsWereOpen);
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

    // Edit is always author-only. Verified Chat moderators may also remove
    // other students' messages; PostgreSQL RLS enforces this server-side.
    if(own || isChatModerator){
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
      const actions=[];
      if(own) actions.push(["Edit",()=>{
        replyTarget=null;editTarget=row.id;
        input.value=row.message||"";
        showComposerContext();input.focus();
        chatFeedback("");
      }]);
      actions.push(["Delete",()=>deleteMessage(row.id)]);
      for(const [label,handler] of actions){
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
    const paths=Array.isArray(row.image_paths)
      ? row.image_paths.filter(x=>typeof x==="string" && x.startsWith(String(row.user_id)+"/"))
        .slice(0,CONFIG.maxImages) : [];
    if(paths.length){
      if(row.message==="📷 Photo")text.hidden=true;
      const gallery=document.createElement("div");
      gallery.className="study-chat-image-gallery";
      gallery.dataset.count=String(paths.length);
      for(const path of paths){
        const tile=document.createElement("a");
        tile.className="study-chat-image-tile is-loading";
        tile.target="_blank";tile.rel="noopener noreferrer";
        tile.setAttribute("aria-label","Open chat attachment");
        const image=document.createElement("img");
        image.alt="Study chat image";image.loading="lazy";
        tile.append(image);gallery.append(tile);
        const cached=imageUrlCache.get(path);
        if(cached?.expires>Date.now()){
          tile.href=cached.url;image.src=cached.url;
          tile.classList.remove("is-loading");
        }else if(client){
          client.storage.from(CONFIG.imageBucket).createSignedUrl(path,3600)
            .then(({data,error})=>{
              if(error || !data?.signedUrl || !tile.isConnected){
                tile.classList.add("is-unavailable");return;
              }
              const url=data.signedUrl;
              imageUrlCache.set(path,{url,expires:Date.now()+3500000});
              tile.href=url;image.src=url;tile.classList.remove("is-loading");
            }).catch(()=>tile.classList.add("is-unavailable"));
        }
      }
      body.append(gallery);
    }
    // A private signed link is created only for paths owned by this message.
    // File names are always text nodes, never executable markup.
    const files=Array.isArray(row.file_attachments) ? row.file_attachments
      .filter(item=>item && typeof item.path==="string" &&
        typeof item.name==="string" &&
        item.path.startsWith(String(row.user_id)+"/"+row.id+"/") &&
        /\/[0-1]\.(pdf|docx|pptx|txt)$/.test(item.path)).slice(0,CONFIG.maxFiles):[];
    if(files.length){
      if(row.message==="📎 File")text.hidden=true;
      const attachments=document.createElement("div");
      attachments.className="study-chat-document-list";
      for(const file of files){
        const link=document.createElement("a");
        link.className="study-chat-document is-loading";
        link.target="_blank";link.rel="noopener noreferrer";
        link.title="Preparing private document link";
        const icon=document.createElement("span");
        icon.className="study-chat-document-icon";
        icon.setAttribute("aria-hidden","true");
        icon.textContent="📄";
        const copy=document.createElement("span");
        copy.className="study-chat-document-copy";
        const filename=document.createElement("strong");
        filename.textContent=file.name.slice(0,120);
        const detail=document.createElement("small");
        const bytes=Number(file.size)||0;
        detail.textContent=(bytes?Math.max(1,Math.round(bytes/1024))+" KB · ":"")+
          String(file.path.split(".").pop()).toUpperCase()+" · private file";
        copy.append(filename,detail);
        link.append(icon,copy);
        attachments.append(link);
        const cached=fileUrlCache.get(file.path);
        if(cached?.expires>Date.now()){
          link.href=cached.url;link.download=file.name;
          link.classList.remove("is-loading");
          link.title="Open or download document";
        }else if(client){
          client.storage.from(CONFIG.fileBucket).createSignedUrl(file.path,3600)
            .then(({data,error})=>{
              if(!link.isConnected)return;
              if(error || !data?.signedUrl){
                link.classList.replace("is-loading","is-unavailable");
                link.title="File is unavailable";return;
              }
              fileUrlCache.set(file.path,{url:data.signedUrl,expires:Date.now()+3500000});
              link.href=data.signedUrl;link.download=file.name;
              link.title="Open or download document";
              link.classList.remove("is-loading");
            }).catch(()=>{
              link.classList.replace("is-loading","is-unavailable");
              link.title="File is unavailable";
            });
        }
      }
      body.append(attachments);
    }

    // Telegram-style: used reactions and counts stay on the bubble;
    // unused choices stay hidden inside the existing React picker.
    const usedReactions=document.createElement("div");
    usedReactions.className="study-chat-reactions-used";
    usedReactions.setAttribute("aria-label","Message reaction counts");
    messageReactions(row.id,usedReactions,true);
    const reactions=document.createElement("div");
    reactions.className="study-chat-reactions";
    messageReactions(row.id,reactions);
    const footer=document.createElement("div");
    footer.className="study-chat-message-foot";
    const footerActions=document.createElement("div");
    footerActions.className="study-chat-message-foot-actions";
    const reply=document.createElement("button");
    reply.type="button";reply.className="study-chat-message-reply";
    reply.textContent="↩ Reply";
    reply.addEventListener("click",()=>{
      if(editTarget)input.value="";
      editTarget=null;replyTarget=row.id;
      showComposerContext();input.focus();chatFeedback("");
    });
    const react=document.createElement("button");
    react.type="button";react.className="study-chat-react-toggle";
    react.textContent="☺ React";
    react.setAttribute("aria-label","Show reactions to this message");
    react.setAttribute("aria-expanded",String(reactionsWereOpen));
    react.addEventListener("click",()=>{
      for(const open of list.querySelectorAll(".study-chat-message.is-reactions-open"))
        if(open.dataset.messageId!==row.id)closeReactionPicker(open.dataset.messageId);
      const visible=article.classList.toggle("is-reactions-open");
      react.setAttribute("aria-expanded",String(visible));
      react.setAttribute("aria-label",visible?"Hide reactions":"Show reactions to this message");
    });
    footerActions.append(reply,react);
    const timestamp=document.createElement("span");
    timestamp.className="study-chat-message-time";
    timestamp.textContent=formatTime(row.created_at)+(row.edited_at?" · edited":"");
    footer.append(footerActions,timestamp);
    article.replaceChildren(header,body,usedReactions,reactions,footer);

    if(!existing){
      if(animate && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
        article.classList.add("is-entering");
      list.appendChild(article);
    }
    while(list.querySelectorAll(".study-chat-message").length>CONFIG.maxMessages){
      const oldest=list.querySelector(".study-chat-message");
      if(oldest){
        messagesById.delete(oldest.dataset.messageId);
        reactionsByMessage.delete(oldest.dataset.messageId);
        oldest.remove();
      }
    }
    // Dates are derived from actual message timestamps, not stored separately.
    if(!existing)refreshDateSeparators();
    placePendingText();
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
    const message=messagesById.get(id);
    if(!client || !userId || !message || (!isChatModerator && message.user_id!==userId))return;
    const moderating=message.user_id!==userId;
    const confirmation=moderating
      ? "As a Chat moderator, permanently delete this student's message? This action will be privately logged."
      : "Delete your message? This cannot be undone.";
    if(!window.confirm(confirmation))return;
    // Moderators select by message ID; ordinary users are also constrained
    // by their own user ID. Server-side RLS is the final authority.
    let request=client.from(CONFIG.table).delete().eq("id",id);
    if(!isChatModerator)request=request.eq("user_id",userId);
    const {data,error}=await request.select("id");
    if(error || !data?.length){
      chatFeedback(moderating?"Moderator deletion was not authorized or the message is gone."
        :"Could not delete message.",true);
      return;
    }
    chatFeedback("");
    messageEventSeq+=1;
    deleteMessageLocally(id);
    if(Array.isArray(message.image_paths) && message.image_paths.length){
      const {error:storageError}=await client.storage.from(CONFIG.imageBucket)
        .remove(message.image_paths);
      if(storageError)console.warn("Chat image cleanup:",storageError);
    }
    const documents=Array.isArray(message.file_attachments)
      ? message.file_attachments.map(item=>item?.path).filter(Boolean):[];
    if(documents.length){
      const {error:storageError}=await client.storage.from(CONFIG.fileBucket).remove(documents);
      if(storageError)console.warn("Chat document cleanup:",storageError);
    }
  }
  function deleteMessageLocally(id) {
    messagesById.delete(id);reactionsByMessage.delete(id);
    for(const element of list.querySelectorAll(".study-chat-message")){
      if(element.dataset.messageId!==id)continue;
      if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)element.remove();
      else {element.classList.add("is-exiting");setTimeout(()=>element.remove(),220);}
    }
    if(editTarget===id||replyTarget===id)clearComposerContext();
    if(messagesById.size===0)renderInitial([]);
    else{
      for(const row of [...messagesById.values()]){
        if(row.reply_to===id)renderMessage({...row,reply_to:null});
      }
      refreshDateSeparators();
    }
  }

  function dateKey(date){
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),
      String(date.getDate()).padStart(2,"0")].join("-");
  }
  function dateLabel(date){
    const today=new Date();today.setHours(0,0,0,0);
    const midnight=new Date(date);midnight.setHours(0,0,0,0);
    if(midnight.getTime()===today.getTime())return "Today";
    const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
    if(midnight.getTime()===yesterday.getTime())return "Yesterday";
    return date.toLocaleDateString(undefined,{
      day:"numeric",month:"long",
      ...(date.getFullYear()!==today.getFullYear()?{year:"numeric"}:{})
    });
  }
  function refreshDateSeparators(){
    if(!list)return;
    list.querySelectorAll(".study-chat-date-separator").forEach(item=>item.remove());
    let previousKey="";
    for(const node of list.querySelectorAll(".study-chat-message")){
      const row=messagesById.get(node.dataset.messageId);
      if(!row?.created_at)continue;
      const date=new Date(row.created_at);
      if(!Number.isFinite(date.getTime()))continue;
      const key=dateKey(date);
      if(key===previousKey)continue;
      const label=dateLabel(date);
      const separator=document.createElement("div");
      separator.className="study-chat-date-separator";
      separator.textContent=label;
      separator.setAttribute("role","separator");
      separator.setAttribute("aria-label","Messages from "+label);
      list.insertBefore(separator,node);
      previousKey=key;
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
      placePendingText();
      return;
    }

    rows.slice(-CONFIG.maxMessages).forEach(renderMessage);
    refreshDateSeparators();
    placePendingText();
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
    if(attachButton)attachButton.disabled = !client || busyMessageAction || Boolean(editTarget);
    if(attachmentsToggle)attachmentsToggle.disabled = !client || busyMessageAction ||
      Boolean(editTarget);
    if(fileButton)fileButton.disabled = !client || !fileSharingAvailable ||
      busyMessageAction || Boolean(editTarget);
    if (sendButton) {
      sendButton.disabled =
        (!length && !pendingImages.length && !pendingFiles.length) ||
        length > CONFIG.maxLength ||
        !client ||
        busyMessageAction ||
        (pendingTextQueue.length>0 && (!instantChatMode || Boolean(editTarget) || Boolean(pendingImages.length+pendingFiles.length))) ||
        pendingTextQueue.length>=MAX_TEXT_QUEUE ||
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
      .select(selectMessageColumns())
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


  // Reconcile the newest 100 messages after an interrupted Realtime channel.
  // Preserve the composer and user interaction state rather than resetting Chat.
  async function syncChatSnapshot() {
    if (!client || !list) return;
    if (syncingMessages) { syncRequested = true; return; }
    syncingMessages = true;
    lastChatSyncAt = Date.now();
    const startEvents = messageEventSeq;
    try {
      const {data,error} = await client.from(CONFIG.table)
        .select(selectMessageColumns())
        .order("created_at",{ascending:false})
        .order("id",{ascending:false})
        .limit(CONFIG.maxMessages);
      if (error) { console.warn("Chat catch-up unavailable:",error); return; }
      if (startEvents !== messageEventSeq || busyMessageAction) {
        syncRequested = true; return;
      }
      const rows = (data || []).reverse();
      const ids = new Set(rows.map(row=>row.id));
      const nearBottom = list.scrollHeight-list.scrollTop-list.clientHeight<140;
      const previousTop = list.scrollTop;
      const fields = ["message","created_at","edited_at","reply_to","nickname","image_paths"];
      if(fileSharingAvailable)fields.push("file_attachments");
      for (const row of rows) {
        const previous = messagesById.get(row.id);
        if (!previous || fields.some(field =>
          JSON.stringify(previous[field]) !== JSON.stringify(row[field]))) renderMessage(row);
      }
      for (const id of [...messagesById.keys()]) {
        if (ids.has(id)) continue;
        messagesById.delete(id);
        reactionsByMessage.delete(id);
        const old = [...list.querySelectorAll(".study-chat-message")]
          .find(node=>node.dataset.messageId===id);
        old?.remove();
        if(editTarget===id || replyTarget===id)clearComposerContext();
      }
      if (!rows.length) renderInitial([]);
      else {
        const nodes = new Map([...list.querySelectorAll(".study-chat-message")]
          .map(node=>[node.dataset.messageId,node]));
        for (const row of rows) {
          const node = nodes.get(row.id);
          if(node)list.appendChild(node);
        }
        refreshDateSeparators();
        placePendingText();
        if(nearBottom)scrollToBottom(true);
        else list.scrollTop=previousTop;
      }
      await loadProfiles();
      await loadReactions();
    }catch(error){console.warn("Chat catch-up failed:",error);}
    finally {
      syncingMessages=false;
      if(syncRequested){
        syncRequested=false;
        window.setTimeout(()=>syncChatSnapshot(),500);
      }
    }
  }

  function refreshTyping() {
    if(!typingBar || !channel || !isOpen || document.hidden){
      if(typingBar)typingBar.hidden=true;
      return;
    }
    const values=Object.values(channel.presenceState() || {}).flat();
    const other=values.filter(item=>item && item.typing && item.id!==userId &&
      Date.now()-Number(item.updatedAt||0)<7000);
    typingBar.hidden=!other.length;
    if(other.length && typingLabel)
      typingLabel.textContent=other.length===1
        ? String(other[0].nickname||"Someone")+" is typing…"
        : "Students are typing…";
  }
  function publishTyping(typing) {
    clearTimeout(typingIdleTimer);
    if(!channelSubscribed || !channel || !userId)return;
    const now=Date.now();
    if(typing && (!isOpen || document.hidden))return;
    // Presence updates are rate-limited by Supabase. Track on state change,
    // then at most once every 6 seconds while continually typing.
    if(typing){
      if(!typingActive || now-lastTypingSent>=6000){
        typingActive=true;
        lastTypingSent=now;
        channel.track({id:userId,nickname,typing:true,updatedAt:now})
          .catch(error=>console.warn("Chat typing presence:",error?.message));
      }
      typingIdleTimer=setTimeout(()=>publishTyping(false),2800);
      return;
    }
    if(typingActive){
      typingActive=false;
      lastTypingSent=now;
      channel.track({id:userId,nickname,typing:false,updatedAt:now})
        .catch(()=>{});
    }
  }
  function scheduleChatReconnect(immediate = false) {
    if (!client || channelSubscribed || reconnecting ||
        document.hidden || navigator.onLine === false) return;
    if(reconnectTimer){
      if(!immediate)return;
      clearTimeout(reconnectTimer);
    }
    const delay=immediate?0:
      Math.min(30000,1500*2**Math.min(reconnectAttempts,4))+
      Math.floor(Math.random()*350);
    reconnectAttempts+=1;
    reconnectTimer=window.setTimeout(async()=>{
      reconnectTimer=0;
      if(channelSubscribed || reconnecting ||
          document.hidden || navigator.onLine===false)return;
      reconnecting=true;
      const old=channel;
      channel=null; // Discard callbacks from this retired channel.
      try {
        if(old && typeof client.removeChannel==="function")
          await client.removeChannel(old);
      }catch(error){console.warn("Chat channel cleanup:",error);}
      finally{reconnecting=false;}
      if(!channel && !document.hidden && navigator.onLine!==false){
        try{subscribe();}
        catch(error){
          console.warn("Chat resubscribe failed:",error);
          scheduleChatReconnect();
        }
      }
    },delay);
  }

  function subscribe() {
    if(!client || channel)return;
    const next=client
      .channel("studylab-chat-room",{config:{presence:{key:sessionKey}}})
      .on("postgres_changes",
        {event:"*",schema:"public",table:CONFIG.table},
        payload=>{
          if(channel!==next)return;
          messageEventSeq+=1;
          if(payload.eventType==="DELETE"){
            deleteMessageLocally(payload.old?.id);
            return;
          }
          const row=payload.new;
          if(!row?.id)return;
          if(pendingTextCards.has(row.id)&&row.user_id===userId)clearPendingCard(row.id);
          const wasKnown=messagesById.has(row.id);
          const wasNearBottom=list &&
            list.scrollHeight-list.scrollTop-list.clientHeight<140;
          renderMessage(row,payload.eventType==="INSERT");
          if(payload.eventType==="INSERT"){
            if(!isOpen && row.user_id!==userId)setUnread(unreadCount+1);
            if(wasNearBottom || row.session_id===sessionKey)scrollToBottom(true);
            loadProfiles();
          }else if(wasKnown)loadProfiles();
        })
      .on("postgres_changes",
        {event:"*",schema:"public",table:"studylab_chat_reactions"},
        payload=>{
          if(channel!==next)return;
          const id=payload.new?.message_id || payload.old?.message_id;
          if(id)reactionRefreshIds.add(id);
          clearTimeout(reactionSyncTimer);
          reactionSyncTimer=setTimeout(()=>{
            const changed=[...reactionRefreshIds];
            reactionRefreshIds.clear();
            loadReactions(changed.length?changed:undefined);
          },140);
        })
      .on("presence",{event:"sync"},()=>{
        if(channel===next)refreshTyping();
      });
    // Set channel before subscribe(): some channel mocks and implementations
    // invoke the status callback synchronously.
    channel=next;
    next.subscribe((status,error)=>{
      if(channel!==next)return;
      if(status==="SUBSCRIBED"){
        channelSubscribed=true;
        clearTimeout(reconnectTimer);
        reconnectTimer=0;
        reconnectAttempts=0;
        setStatus(true,"Live • newest 100 messages");
        publishTyping(false);
        void syncChatSnapshot();
      }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
        channelSubscribed=false;
        typingActive=false;
        if(error)console.warn("StudyLab Chat realtime "+status+":",error);
        setStatus(false,navigator.onLine===false
          ?"Offline · waiting for connection"
          :"Reconnecting live updates · messages still refresh periodically");
        if(typingBar)typingBar.hidden=true;
        scheduleChatReconnect();
      }
    });
  }

  function clearPendingImages() {
    for(const item of pendingImages)URL.revokeObjectURL(item.previewUrl);
    pendingImages=[];
    if(imageInput)imageInput.value="";
    renderPendingImages();
  }
  function clearPendingFiles(){
    pendingFiles=[];
    if(fileInput)fileInput.value="";
    renderPendingImages();
  }
  function renderPendingImages() {
    if(!attachPreview)return;
    attachPreview.replaceChildren();
    attachPreview.hidden=!pendingImages.length && !pendingFiles.length;
    for(const item of pendingImages){
      const tile=document.createElement("span");
      tile.className="study-chat-pending-tile";
      const img=document.createElement("img");
      img.alt="Image ready to attach";img.src=item.previewUrl;
      const remove=document.createElement("button");
      remove.type="button";remove.textContent="×";
      remove.setAttribute("aria-label","Remove attached image");
      remove.addEventListener("click",()=>{
        pendingImages=pendingImages.filter(x=>x!==item);
        URL.revokeObjectURL(item.previewUrl);
        renderPendingImages();updateComposer();
      });
      tile.append(img,remove);attachPreview.append(tile);
    }
    for(const item of pendingFiles){
      const tile=document.createElement("span");
      tile.className="study-chat-pending-document";
      const label=document.createElement("span");
      label.textContent="📎 "+item.file.name;
      label.title=item.file.name;
      const remove=document.createElement("button");
      remove.type="button";remove.textContent="×";
      remove.setAttribute("aria-label","Remove "+item.file.name);
      remove.addEventListener("click",()=>{
        pendingFiles=pendingFiles.filter(x=>x!==item);
        renderPendingImages();updateComposer();
      });
      tile.append(label,remove);attachPreview.append(tile);
    }
    if(pendingImages.length || pendingFiles.length){
      const caption=document.createElement("small");
      caption.className="study-chat-pending-count";
      const parts=[];
      if(pendingImages.length)parts.push(pendingImages.length+"/3 images · 1 MB each");
      if(pendingFiles.length)parts.push(pendingFiles.length+"/2 documents · 5 MB each");
      caption.textContent=parts.join(" · ");
      attachPreview.append(caption);
    }
  }

  const fileTypes={
    pdf:"application/pdf",
    docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt:"text/plain"
  };
  async function validateChatFile(file){
    const extension=String(file?.name||"").split(".").pop().toLowerCase();
    if(!Object.hasOwn(fileTypes,extension))
      throw Error("Attach PDF, DOCX, PPTX or TXT study files only.");
    if(file.size<1 || file.size>CONFIG.maxFileBytes)
      throw Error("Each document must be between 1 byte and 5 MB.");
    if(file.name.length>120 || /[\x00-\x1f\x7f]/.test(file.name))
      throw Error("Document name must be under 120 characters.");
    if(file.type && file.type!=="application/octet-stream" &&
        file.type!==fileTypes[extension])
      throw Error("File extension and document type do not match.");
    // Basic magic-byte checks reject obvious extension spoofing, but are
    // not malware scanning. Open shared documents with normal caution.
    if(typeof file.slice==="function" && typeof file.arrayBuffer==="function"){
      const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
      if(extension==="pdf" &&
          String.fromCharCode(...bytes.slice(0,5))!=="%PDF-")
        throw Error("The selected PDF does not have a PDF header.");
      if(["docx","pptx"].includes(extension) &&
          !(bytes[0]===0x50 && bytes[1]===0x4b))
        throw Error("The selected Office file is not a valid document package.");
    }
    return {file,extension,mime:fileTypes[extension]};
  }
  async function handleFileSelection(event){
    const files=[...(event.target.files||[])];
    if(fileInput)fileInput.value="";
    if(!files.length)return;
    if(!fileSharingAvailable){
      chatFeedback("Document sharing is not enabled on this deployment yet.",true);
      return;
    }
    if(editTarget){chatFeedback("Finish editing before attaching files.",true);return;}
    if(files.length+pendingFiles.length>CONFIG.maxFiles){
      chatFeedback("Up to two documents per message (5 MB each).",true);return;
    }
    if(fileButton)fileButton.disabled=true;
    try{
      const checked=await Promise.all(files.map(validateChatFile));
      pendingFiles.push(...checked);
      renderPendingImages();chatFeedback("");
    }catch(error){chatFeedback(error.message||"Unable to attach document.",true);}
    finally{updateComposer();}
  }

  async function compressChatImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) ||
        file.size > CONFIG.maxSourceBytes)
      throw Error("Choose a JPG, PNG, or WebP file under 12 MB.");
    const url = URL.createObjectURL(file);
    let bitmap, source, w = 0, h = 0;
    try {
      if (typeof createImageBitmap === "function") {
        bitmap = await createImageBitmap(file);
        source = bitmap; w = bitmap.width; h = bitmap.height;
      } else {
        source = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject; image.src = url;
        });
        w = source.naturalWidth; h = source.naturalHeight;
      }
      if (!w || !h || w * h > 60000000)
        throw Error("Unsupported image dimensions.");
      let scale = Math.min(1, 1280 / Math.max(w, h));
      for (let n = 0; n < 8; n++) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw Error("Image compression is unavailable in this browser.");
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        const quality = n < 3 ? [0.82, 0.70, 0.58][n] : 0.58;
        const blob = await new Promise(resolve =>
          canvas.toBlob(resolve, "image/webp", quality));
        if (blob && blob.type === "image/webp" &&
            blob.size > 0 && blob.size <= CONFIG.maxImageBytes)
          return blob;
        scale *= 0.8;
      }
      throw Error("Image could not be compressed under 1 MB.");
    } finally {
      bitmap?.close?.();
      URL.revokeObjectURL(url);
    }
  }
  async function handleImageSelection(event) {
    const files = Array.from(event.target.files || []);
    if (imageInput) imageInput.value = "";
    if (!files.length) return;
    if (editTarget) {
      chatFeedback("Finish editing before attaching images.", true); return;
    }
    if (files.length + pendingImages.length > CONFIG.maxImages) {
      chatFeedback("Up to three images per message.", true); return;
    }
    attachButton.disabled = true;
    try {
      for (const file of files) {
        const blob = await compressChatImage(file);
        pendingImages.push({ blob, previewUrl: URL.createObjectURL(blob) });
      }
      renderPendingImages(); chatFeedback("");
    } catch (error) {
      chatFeedback(error.message || "Image could not be prepared.", true);
    } finally {
      updateComposer();
    }
  }

  function messageFailure(error, editing) {
    if(String(error?.message||"").startsWith("Guardian:")) return String(error.message);
    const reason=String(error?.message || "").toLowerCase();
    const code=String(error?.code || "").toUpperCase();
    if (/wait before sending|rate.limit|too many requests/.test(reason) || code==="429")
      return "Please wait a moment before sending another message.";
    if (/jwt|token|session|not authenticated|auth.uid|unauthorized/.test(reason) || code==="PGRST301")
      return "Your chat session needs refreshing. Sign out and sign back in if it persists.";
    if (/permission|row-level|policy|42501/.test(reason) || code==="42501")
      return "Message blocked by chat permissions. Refresh your account and retry.";
    if (/foreign key/.test(reason) || code==="23503")
      return "The message you replied to is no longer available. Cancel reply and retry.";
    if (code==="23514" || /check constraint|too long|nickname/.test(reason))
      return "This message does not meet the chat limits. Check the text and selected images.";
    if (/failed to fetch|network|timeout|websocket|load failed|connection|offline/.test(reason))
      return "Connection interrupted. Your text and attachments are still here. Retry sending.";
    if (/document|file|storage|bucket|mime|size/.test(reason))
      return "Attachment upload failed. Check file limits and try again.";
    if (/image/.test(reason))
      return "Image upload failed. Check your selected images and try again.";
    // Preserve text on failure, and provide a traceable error code without
    // revealing raw SQL statements or other students' information.
    return (editing?"Could not edit message":"Message could not be sent") +
      (code && /^[0-9A-Z]{3,12}$/.test(code)?" ("+code+").":"; please retry.");
  }
  // A temporary Realtime disconnection must not block REST inserts.
  // Retry an explicit expired-token error once, using the SAME message ID.
  // Do not retry unknown failures: a successful write may have returned
  // without an acknowledgement and an extra write would duplicate it.
  function staleChatSession(error) {
    const code=String(error?.code||"").toUpperCase();
    const reason=String(error?.message||"").toLowerCase();
    return code==="PGRST301" || code==="401" ||
      /jwt expired|token expired|invalid jwt|invalid token|jwt issued at future|session expired/.test(reason);
  }
  async function writeChatMessage(work) {
    let result=await work();
    if (!result?.error || !staleChatSession(result.error) ||
        typeof client?.auth?.refreshSession!=="function") return result;
    const refreshed=await client.auth.refreshSession();
    if (refreshed.error || !refreshed.data?.session?.user?.id)
      return result;
    if (refreshed.data.session.user.id!==userId)
      return {error:new Error("Your signed-in account changed. Reload StudyLab chat.")};
    result=await work();
    return result;
  }

  // Local-only outbox: never put pending content in the public message map or Realtime.
  function placePendingText(){
    if(!list)return;
    if(pendingTextCards.size){if(list.lastElementChild!==pendingTextHost)list.appendChild(pendingTextHost);}
    else pendingTextHost.remove();
  }
  function updatePendingCard(item,state,detail){
    let card=pendingTextCards.get(item.id);
    if(!card){
      card=document.createElement("article");card.className="study-chat-local-pending";
      card.dataset.localMessageId=item.id;
      const name=document.createElement("strong");name.textContent="You";
      const body=document.createElement("div");body.className="study-chat-local-text";body.textContent=item.message;
      const meta=document.createElement("div");meta.className="study-chat-local-state";meta.setAttribute("role","status");
      const actions=document.createElement("div");actions.className="study-chat-local-actions";
      card.append(name,body,meta,actions);pendingTextCards.set(item.id,card);pendingTextHost.append(card);
    }
    card.dataset.state=state;
    card.querySelector(".study-chat-local-state").textContent=detail;
    const actions=card.querySelector(".study-chat-local-actions");actions.replaceChildren();
    if(state==="failed"){
      const revise=document.createElement("button");revise.type="button";revise.textContent="Edit draft";
      revise.onclick=()=>{
        if(input.value.trim()||editTarget||pendingImages.length||pendingFiles.length){chatFeedback("Finish your current draft first.",true);return;}
        input.value=item.message;
        if(item.replyTo&&messagesById.has(item.replyTo))replyTarget=item.replyTo;
        clearPendingCard(item.id);showComposerContext();input.focus();updateComposer();
      };
      const dismiss=document.createElement("button");dismiss.type="button";dismiss.textContent="Dismiss";dismiss.onclick=()=>clearPendingCard(item.id);
      actions.append(revise,dismiss);
    }
    placePendingText();
  }
  function clearPendingCard(id){
    pendingTextCards.get(id)?.remove();pendingTextCards.delete(id);placePendingText();
  }
  async function loadInstantChatMode(){
    try{
      const r=await client.rpc("studylab_guardian_chat_mode");
      if(!r.error&&["instant","strict"].includes(r.data)){instantChatMode=r.data==="instant";updateComposer();}
    }catch(_){}
  }
  function queueText(message,now){
    const item={id:crypto.randomUUID(),message,replyTo:replyTarget,actor:userId,client,nickname:String(nickname||"Student").trim().slice(0,40)||"Student"};
    pendingTextQueue.push(item);lastSentAt=now;
    // Keep at most six failed local cards; never remove active queued messages.
    const failed=[...pendingTextCards.entries()].filter(([,n])=>n.dataset.state==="failed");
    if(failed.length>=6)clearPendingCard(failed[0][0]);
    updatePendingCard(item,"pending","Waiting for safety check · only you can see this");
    input.value="";clearComposerContext();publishTyping(false);chatFeedback("");updateComposer();scrollToBottom(true);
    window.setTimeout(updateComposer,CONFIG.rateLimitMs+20);
    void drainTextQueue();
  }
  async function drainTextQueue(){
    if(queueRunning)return;queueRunning=true;
    try{
      while(pendingTextQueue.length){
        const item=pendingTextQueue[0];
        try{
          if(client!==item.client||userId!==item.actor)throw Error("Guardian: chat account changed. Reload before sending.");
          updatePendingCard(item,"pending","Checking safety · only you can see this");
          // Approval is still required BEFORE the public INSERT. No unchecked content is broadcast.
          // Space successful writes to respect the existing DB chat rate limit.
          const wait=Math.max(0,CONFIG.rateLimitMs+50-(Date.now()-lastQueueWrite));
          if(wait)await new Promise(resolve=>window.setTimeout(resolve,wait));
          await window.StudyLabGuardianCheck(item.client,"chat",item.message);
          if(client!==item.client||userId!==item.actor)throw Error("Guardian: chat account changed. Reload before sending.");
          const values={id:item.id,message:item.message,session_id:sessionKey,user_id:item.actor,nickname:item.nickname,image_paths:[]};
          if(item.replyTo&&messagesById.has(item.replyTo))values.reply_to=item.replyTo;
          const {error}=await writeChatMessage(()=>item.client.from(CONFIG.table).insert(values));
          if(error)throw error;
          lastQueueWrite=Date.now();
          clearPendingCard(item.id);
          if(!messagesById.has(item.id)){messageEventSeq+=1;renderMessage({...values,created_at:new Date().toISOString()},true);}
          scrollToBottom(true);
        }catch(error){
          // A lost acknowledgement can coincide with a successful Realtime INSERT.
          // Never auto-retry an unknown write or create a duplicate message.
          if(messagesById.has(item.id))clearPendingCard(item.id);
          else updatePendingCard(item,"failed",messageFailure(error,false));
        }finally{pendingTextQueue.shift();updateComposer();}
      }
    }finally{queueRunning=false;updateComposer();}
  }

  async function sendMessage() {
    if(!client || !input || busyMessageAction)return;
    const message=input.value.trim();
    if((!message && !pendingImages.length && !pendingFiles.length) ||
        message.length>CONFIG.maxLength){
      updateComposer();return;
    }
    const now=Date.now();
    if(!editTarget && now-lastSentAt<CONFIG.rateLimitMs)return;
    if(pendingTextQueue.length>=MAX_TEXT_QUEUE)return;
    if(instantChatMode&&!editTarget&&!pendingImages.length&&!pendingFiles.length){
      queueText(message,now);return;
    }
    if(pendingTextQueue.length){chatFeedback("Your pending messages are being sent. Please try again shortly.",true);return;}
    busyMessageAction=true;
    if(!editTarget)lastSentAt=now;
    updateComposer();chatFeedback("");
    try {
      const editingId=editTarget;
      await window.StudyLabGuardianCheck(client,"chat",message||(pendingImages.length?"📷 Photo":"📎 File"));
      let error;
      if(editingId){
        if(messagesById.get(editingId)?.user_id!==userId)
          throw new Error("Only the author can edit this message.");
        ({error}=await writeChatMessage(() => client.from(CONFIG.table)
          .update({message}).eq("id",editingId).eq("user_id",userId)));
      }else{
        const id=crypto.randomUUID();
        const uploaded=[];
        const uploadedFiles=[];
        try {
          for(let i=0;i<pendingImages.length;i++){
            const path=userId+"/"+id+"/"+i+".webp";
            const result=await client.storage.from(CONFIG.imageBucket)
              .upload(path,pendingImages[i].blob,{contentType:"image/webp",upsert:false});
            if(result.error)throw result.error;
            uploaded.push(path);
          }
          for(let i=0;i<pendingFiles.length;i++){
            const item=pendingFiles[i];
            // The server also enforces owner / message ID / allowed extensions.
            const path=userId+"/"+id+"/"+i+"."+item.extension;
            const result=await client.storage.from(CONFIG.fileBucket)
              .upload(path,item.file,{contentType:item.mime,upsert:false});
            if(result.error)throw result.error;
            uploadedFiles.push({path,name:item.file.name,size:item.file.size});
          }
          const values={
            id,message:message||(pendingImages.length?"📷 Photo":"📎 File"),
            session_id:sessionKey,
            user_id:userId,nickname:String(nickname||"Student").trim().slice(0,40)||"Student",
            image_paths:uploaded
          };
          if(fileSharingAvailable && uploadedFiles.length)
            values.file_attachments=uploadedFiles;
          if(replyTarget && messagesById.has(replyTarget))values.reply_to=replyTarget;
          ({error}=await writeChatMessage(() => client.from(CONFIG.table).insert(values)));
          if(error)throw error;
          lastQueueWrite=Date.now();
          // A successful server insert must be visible to its author even if
          // the WebSocket channel is temporarily disconnected.
          if(!messagesById.has(id)){
            messageEventSeq+=1;
            renderMessage({...values,created_at:new Date().toISOString()},true);
            scrollToBottom(true);
          }
        }catch(uploadError){
          if(uploaded.length){
            try{await client.storage.from(CONFIG.imageBucket).remove(uploaded);}
            catch(cleanupError){console.warn("Chat image upload rollback:",cleanupError);}
          }
          if(uploadedFiles.length){
            try{await client.storage.from(CONFIG.fileBucket)
              .remove(uploadedFiles.map(item=>item.path));}
            catch(cleanupError){console.warn("Chat file upload rollback:",cleanupError);}
          }
          throw uploadError;
        }
      }
      if(error)throw error;
      input.value="";
      clearPendingImages();
      clearPendingFiles();
      clearComposerContext();resizeMessageInput();updateComposer();
      publishTyping(false);
    }catch(error){
      console.warn("StudyLab Chat message action:",error);
      chatFeedback(messageFailure(error,Boolean(editTarget)),true);
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

    if (!open) {
      setAttachmentMenu(false);
      publishTyping(false);
    }
    if (open) {
      syncMobileChatHeaderOffset();
      if(!channelSubscribed)scheduleChatReconnect(true);
      if(client && Date.now()-lastChatSyncAt>30000)void syncChatSnapshot();
      if(client)void loadInstantChatMode();
      window.dispatchEvent(new Event("studylab-chat-open"));
      closeQuickAccess();
      setUnread(0);
      scrollToBottom(true);
      resizeMessageInput();
      refreshTyping();
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

    panel?.addEventListener("click", event => {
      event.stopPropagation();
      if(attachmentsMenu && !attachmentsMenu.hidden &&
         !attachmentsMenu.contains(event.target) &&
         !attachmentsToggle?.contains(event.target))
        setAttachmentMenu(false);
    });

    form?.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage();
    });

    input?.addEventListener("input",()=>{
      chatFeedback("");
      resizeMessageInput();
      updateComposer();
      publishTyping(Boolean(input.value.trim()));
    });
    attachmentsToggle?.addEventListener("click",event=>{
      event.stopPropagation();
      setAttachmentMenu(attachmentsMenu.hidden || !attachmentsMenu.classList.contains("is-open"));
    });
    attachButton?.addEventListener("click",()=>{
      setAttachmentMenu(false);
      imageInput?.click();
    });
    imageInput?.addEventListener("change",handleImageSelection);
    fileButton?.addEventListener("click",()=>{
      setAttachmentMenu(false);
      fileInput?.click();
    });
    fileInput?.addEventListener("change",handleFileSelection);
    document.addEventListener("click",event=>{
      if(attachmentsMenu && !attachmentsMenu.hidden &&
         !attachmentsMenu.contains(event.target) && !attachmentsToggle?.contains(event.target))
        setAttachmentMenu(false);
    });
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden)publishTyping(false);
      else {
        if(!channelSubscribed)scheduleChatReconnect(true);
        void syncChatSnapshot();
      }
    });
    window.addEventListener("online",()=>{
      if(!channelSubscribed)scheduleChatReconnect(true);
      void syncChatSnapshot();
    });
    // Low-frequency fallback lets an open Chat recover when PostgreSQL
    // changes are unavailable, without continuous background API requests.
    window.setInterval(()=>{
      if(!client || !isOpen || document.hidden || navigator.onLine===false)return;
      const interval=channelSubscribed?60000:15000;
      if(Date.now()-lastChatSyncAt>=interval)void syncChatSnapshot();
    },15000);
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
        if(attachmentsMenu && !attachmentsMenu.hidden){
          setAttachmentMenu(false);
          attachmentsToggle?.focus();
          return;
        }
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

      // Read-only permission lookup. Auth account IDs are checked in a
      // private DB table; browser email strings never grant moderator rights.
      const moderatorResult=await client.rpc("studylab_chat_can_moderate");
      if(moderatorResult.error){
        console.warn("Chat moderator permission lookup unavailable:",moderatorResult.error);
      }
      isChatModerator=moderatorResult.data===true;
      void loadInstantChatMode();
      // The PR includes a migration but the production database is not
      // modified until the admin explicitly approves it. Feature detection
      // keeps all existing text/image chat working before that migration.
      try {
        const capability=await client.from(CONFIG.table)
          .select("file_attachments").limit(1);
        fileSharingAvailable=!capability.error;
      }catch(_){fileSharingAvailable=false;}
      if(fileButton){
        fileButton.title=fileSharingAvailable
          ? "Attach PDF, DOCX, PPTX or TXT (up to 5 MB each)"
          : "Study document upload will be available after the database update";
        fileButton.setAttribute("aria-label",fileButton.title);
      }
      updateComposer();
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
