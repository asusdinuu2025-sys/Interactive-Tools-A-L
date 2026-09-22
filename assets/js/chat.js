/* =========================================================
   STUDY LAB — TEMPORARY 24-HOUR CHAT
   Anonymous, text-only, Realtime Supabase chat.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    supabaseUrl: "https://zpvatyxdbshjuqgtexzw.supabase.co",
    supabasePublishableKey: "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB",
    table: "studylab_chat_messages",
    maxMessages: 50,
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
        aria-label="Open StudyLab temporary chat"
      >
        <span class="study-chat-button-icon" aria-hidden="true">💬</span>
        <span>Chat</span>
        <span class="study-chat-unread" data-chat-unread hidden aria-label="Unread messages"></span>
      </button>

      <aside
        class="study-chat-panel"
        id="studyChatPanel"
        data-chat-panel
        hidden
        aria-label="StudyLab temporary chat"
      >
        <div class="study-chat-head">
          <div class="study-chat-title-wrap">
            <h2 class="study-chat-title">StudyLab Chat</h2>
            <div class="study-chat-meta">
              <span class="study-chat-status-dot is-offline" data-chat-status-dot aria-hidden="true"></span>
              <span data-chat-status>Connecting…</span>
            </div>
          </div>
          <button type="button" class="study-chat-close" data-chat-close aria-label="Close chat">×</button>
        </div>

        <div class="study-chat-notice">
          🎓 Temporary study chat • newest 50 messages • messages older than 24 hours are removed.
          <strong>Please keep conversations educational and respectful.</strong>
        </div>

        <div class="study-chat-list" data-chat-list aria-live="polite"></div>

        <form class="study-chat-compose" data-chat-form>
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
  const list = root.querySelector("[data-chat-list]");
  const form = root.querySelector("[data-chat-form]");
  const input = root.querySelector("[data-chat-input]");
  const sendButton = root.querySelector("[data-chat-send]");
  const charCount = root.querySelector("[data-chat-count]");
  const statusDot = root.querySelector("[data-chat-status-dot]");
  const statusText = root.querySelector("[data-chat-status]");
  const unread = root.querySelector("[data-chat-unread]");
  const inputWrap = root.querySelector(".study-chat-input-wrap");

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
  let unreadCount = 0;
  let lastSentAt = 0;
  let messagesById = new Map();

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
  });

  function setStatus(online, textValue) {
    statusDot?.classList.toggle("is-offline", !online);
    if (statusText) statusText.textContent = textValue;
  }

  function setUnread(count) {
    unreadCount = Math.max(0, count);
    if (!unread) return;
    unread.hidden = unreadCount === 0;
    if (!unread.hidden) {
      unread.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    }
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

  function renderMessage(row) {
    if (!list || !row?.id) return;

    if (messagesById.has(row.id)) return;
    messagesById.set(row.id, row);
    clearEmptyState();

    const article = document.createElement("article");
    article.className = "study-chat-message";

    if ((row.user_id && row.user_id === userId) || (!row.user_id && row.session_id === sessionKey)) {
      article.classList.add("own");
    }

    const name = document.createElement("div");
    name.className = "study-chat-message-name";
    name.textContent = row.nickname || "Student";

    const message = document.createElement("div");
    message.className = "study-chat-message-text";
    message.textContent = row.message || "";

    const time = document.createElement("div");
    time.className = "study-chat-message-time";
    time.textContent = formatTime(row.created_at);

    article.append(name, message, time);
    list.appendChild(article);

    while (list.querySelectorAll(".study-chat-message").length > CONFIG.maxMessages) {
      const oldest = list.querySelector(".study-chat-message");
      oldest?.remove();
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
        Date.now() - lastSentAt < CONFIG.rateLimitMs;
    }
  }

  function showSetupState() {
    if (!list) return;
    list.innerHTML = `
      <div class="study-chat-setup">
        <strong>Chat is being prepared</strong>
        Run <code>supabase/chat_setup.sql</code> once in your Supabase SQL Editor, then refresh this page.
      </div>
    `;
  }

  async function loadMessages() {
    if (!client) return;

    const { data, error } = await client
      .from(CONFIG.table)
      .select("id,message,created_at,session_id,user_id,nickname")
      .order("created_at", { ascending: true })
      .limit(CONFIG.maxMessages);

    if (error) {
      console.warn("StudyLab Chat load:", error);
      setStatus(false, "Chat setup required");
      showSetupState();
      return;
    }

    renderInitial(data || []);
  }

  function subscribe() {
    if (!client) return;

    channel = client
      .channel("studylab-chat-room")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: CONFIG.table
        },
        payload => {
          const row = payload.new;
          const wasNearBottom =
            list &&
            list.scrollHeight - list.scrollTop - list.clientHeight < 140;

          renderMessage(row);

          if (!isOpen && row.user_id !== userId) {
            setUnread(unreadCount + 1);
          }

          if (wasNearBottom || row.session_id === sessionKey) {
            scrollToBottom(true);
          }
        }
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          setStatus(true, "Live • temporary 24-hour chat");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setStatus(false, "Live connection unavailable");
        }
      });
  }

  async function sendMessage() {
    if (!client || !input) return;

    const now = Date.now();
    if (now - lastSentAt < CONFIG.rateLimitMs) {
      return;
    }

    const message = input.value.trim();
    if (!message || message.length > CONFIG.maxLength) {
      updateComposer();
      return;
    }

    lastSentAt = now;
    updateComposer();

    const { error } = await client
      .from(CONFIG.table)
      .insert({
        message,
        session_id: sessionKey,
        user_id: userId,
        nickname
      });

    if (error) {
      console.warn("StudyLab Chat send:", error);
      setStatus(false, "Message could not be sent");
      lastSentAt = 0;
      updateComposer();
      return;
    }

    input.value = "";
    updateComposer();
    window.setTimeout(updateComposer, CONFIG.rateLimitMs + 20);
  }

  async function cleanupExpired() {
    if (!client) return;

    const { error } = await client.rpc("cleanup_studylab_chat");
    if (error) {
      // Cleanup is also enforced by the insert trigger; keep the chat usable
      // if the optional cleanup RPC has not been created yet.
      console.debug("StudyLab Chat cleanup:", error.message);
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

  function setOpen(open) {
    isOpen = open;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.classList.toggle("is-open", open);

    if (open) {
      closeQuickAccess();
      setUnread(0);
      scrollToBottom(true);
      input?.focus();
    }
  }

  function setupUI() {
    button?.addEventListener("click", event => {
      event.stopPropagation();
      setOpen(!isOpen);
    });

    closeButton?.addEventListener("click", () => setOpen(false));

    panel?.addEventListener("click", event => event.stopPropagation());

    form?.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage();
    });

    input?.addEventListener("input", updateComposer);

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
        setOpen(false);
      }
    });

    window.addEventListener("studylab-quick-open", () => {
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

      await cleanupExpired();
      await loadMessages();
      subscribe();

      window.setInterval(cleanupExpired, 5 * 60 * 1000);
    } catch (error) {
      console.warn("StudyLab Chat:", error);
      setStatus(false, "Chat connection unavailable");
      showSetupState();
    }

    updateComposer();
  }

  boot();
})();
