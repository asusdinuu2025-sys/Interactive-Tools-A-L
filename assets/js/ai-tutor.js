/* =========================================================
   STUDY LAB — ASK AI ANYTHING
   Isolated from the existing temporary live chat. Preview-safe integration.
   No localStorage, no sessionStorage, no database history.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    endpoint: "/.netlify/functions/gemini",
    maxInput: 4000,
    maxHistory: 10,
    cooldownMs: 1200
  };

  function clearText(element) {
    if (element) element.replaceChildren();
  }

  function init() {
    const root = document.querySelector("[data-studylab-ai]");
    if (!root) return;

    const launcher = root.querySelector("[data-ai-launcher]");
    const panel = root.querySelector("[data-ai-panel]");
    const closeButton = root.querySelector("[data-ai-close]");
    const form = root.querySelector("[data-ai-form]");
    const input = root.querySelector("[data-ai-input]");
    const sendButton = root.querySelector("[data-ai-send]");
    const list = root.querySelector("[data-ai-list]");
    const statusDot = root.querySelector("[data-ai-status-dot]");
    const statusText = root.querySelector("[data-ai-status]");

    let isOpen = false;
    let busy = false;
    let lastSentAt = 0;
    let conversation = [];
    let activeController = null;

    function setStatus(type, text) {
      statusDot?.classList.toggle("is-busy", type === "busy");
      statusDot?.classList.toggle("is-error", type === "error");
      if (statusText) statusText.textContent = text;
    }

    function scrollToBottom() {
      if (!list) return;
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });
    }

    function appendMessage(role, text) {
      if (!list || !text) return;

      const article = document.createElement("article");
      article.className = "studylab-ai-message" + (role === "user" ? " user" : "");

      const label = document.createElement("div");
      label.className = "studylab-ai-message-role";
      label.textContent = role === "user" ? "You" : "StudyLab AI";

      const message = document.createElement("div");
      message.className = "studylab-ai-message-text";
      message.textContent = text;

      article.append(label, message);
      list.appendChild(article);
      scrollToBottom();
    }

    function renderEmpty() {
      clearText(list);

      const welcome = document.createElement("div");
      welcome.className = "studylab-ai-welcome";
      welcome.innerHTML =
        "<strong>ආයුබෝවන්! 👋</strong><br>" +
        "Ask me anything. Sinhala, English හෝ mixed language වලින් අහන්න පුළුවන්.<br><br>" +
        "A/L Maths, Physics, Chemistry සහ සාමාන්‍ය ප්‍රශ්න ගැනත් අහන්න.";
      list?.appendChild(welcome);
    }

    function updateSendState() {
      const length = input?.value.trim().length || 0;
      if (sendButton) {
        sendButton.disabled =
          busy ||
          length === 0 ||
          length > CONFIG.maxInput ||
          Date.now() - lastSentAt < CONFIG.cooldownMs;
      }
    }

    function setOpen(next) {
      isOpen = Boolean(next);

      if (!panel || !launcher) return;

      panel.classList.toggle("is-open", isOpen);
      panel.setAttribute("aria-hidden", String(!isOpen));
      panel.inert = !isOpen;
      launcher.classList.toggle("is-open", isOpen);
      launcher.setAttribute("aria-expanded", String(isOpen));

      if (isOpen) {
        window.dispatchEvent(new Event("studylab-ai-open"));
        input?.focus();
      }
    }

    function deleteConversation() {
      activeController?.abort();
      activeController = null;

      conversation = [];
      busy = false;
      lastSentAt = 0;

      if (input) {
        input.value = "";
        input.style.height = "auto";
      }

      renderEmpty();
      setStatus("ready", "A/L study assistant");
      updateSendState();
    }

    function closeAI() {
      /*
       * Deliberately clear the conversation before hiding the panel.
       * Nothing is written to localStorage/sessionStorage or a database.
       */
      deleteConversation();
      setOpen(false);
    }

    async function sendQuestion() {
      if (!input || busy) return;

      const message = input.value.trim();

      if (!message || message.length > CONFIG.maxInput) {
        updateSendState();
        return;
      }

      if (Date.now() - lastSentAt < CONFIG.cooldownMs) return;

      lastSentAt = Date.now();
      busy = true;
      updateSendState();
      setStatus("busy", "Thinking…");

      appendMessage("user", message);

      input.value = "";
      input.style.height = "auto";

      const requestHistory = [
        ...conversation,
        {
          role: "user",
          parts: [{ text: message }]
        }
      ].slice(-CONFIG.maxHistory);

      conversation = requestHistory;

      const typing = document.createElement("article");
      typing.className = "studylab-ai-message";
      typing.innerHTML =
        '<div class="studylab-ai-message-role">StudyLab AI</div>' +
        '<div class="studylab-ai-typing" aria-label="AI is typing">' +
        "<span></span><span></span><span></span>" +
        "</div>";
      list?.appendChild(typing);
      scrollToBottom();

      activeController = new AbortController();
      let timeoutId = null;

      try {
        timeoutId = window.setTimeout(() => activeController?.abort(), 32000);

        const response = await fetch(CONFIG.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message,
            history: conversation
          }),
          signal: activeController.signal
        });

        const data = await response.json().catch(() => ({}));

        typing.remove();

        if (!response.ok) {
          throw new Error(data?.error || "The AI could not answer right now.");
        }

        const answer = String(data?.text || "").trim();

        if (!answer) {
          throw new Error("The AI returned an empty response.");
        }

        conversation = [
          ...conversation,
          {
            role: "model",
            parts: [{ text: answer }]
          }
        ].slice(-CONFIG.maxHistory);

        appendMessage("model", answer);
        setStatus("ready", "A/L study assistant");
      } catch (error) {
        typing.remove();

        if (error?.name === "AbortError") {
          if (isOpen) {
            setStatus("error", "Request cancelled");
          }
        } else {
          appendMessage(
            "model",
            "Sorry, I couldn't get an answer right now. " +
              (error?.message || "Please try again.")
          );
          setStatus("error", "AI connection unavailable");
        }
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        activeController = null;
        busy = false;
        updateSendState();
        window.setTimeout(updateSendState, CONFIG.cooldownMs + 20);
      }
    }

    launcher?.addEventListener("click", event => {
      event.stopPropagation();
      setOpen(!isOpen);
    });

    closeButton?.addEventListener("click", closeAI);

    panel?.addEventListener("click", event => event.stopPropagation());

    form?.addEventListener("submit", event => {
      event.preventDefault();
      void sendQuestion();
    });

    input?.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 118) + "px";
      updateSendState();
    });

    input?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form?.requestSubmit();
      }
    });

    document.addEventListener("click", event => {
      if (!isOpen) return;

      if (
        !panel?.contains(event.target) &&
        event.target !== launcher &&
        !launcher?.contains(event.target)
      ) {
        closeAI();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && isOpen) {
        closeAI();
      }
    });

    window.addEventListener("studylab-chat-open", () => {
      if (isOpen) closeAI();
    });

    renderEmpty();
    setOpen(false);
    updateSendState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
