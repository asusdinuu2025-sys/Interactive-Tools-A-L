/* =========================================================
   STUDY LAB — ASK AI ANYTHING
   Completely isolated from the existing temporary live chat.
   Conversation exists only in runtime memory and is cleared on close.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    endpoint: "/.netlify/functions/gemini",
    maxInput: 3000,
    maxHistory: 8,
    cooldownMs: 1200
  };

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
    let lockedForLimit = false;
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
      article.className =
        "studylab-ai-message" + (role === "user" ? " user" : "");

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

    function renderWelcome() {
      if (!list) return;

      list.replaceChildren();

      const welcome = document.createElement("div");
      welcome.className = "studylab-ai-welcome";

      const strong = document.createElement("strong");
      strong.textContent = "ආයුබෝවන්! 👋";

      const body = document.createElement("div");
      body.style.marginTop = "8px";
      body.textContent =
        "Ask anything. Sinhala, English හෝ mixed language වලින් අහන්න පුළුවන්.";

      const detail = document.createElement("div");
      detail.style.marginTop = "7px";
      detail.textContent =
        "A/L Maths, Physics, Chemistry සහ Biology වගේ study questions සඳහා step-by-step help ලැබේ.";

      welcome.append(strong, body, detail);
      list.appendChild(welcome);
    }

    function updateSendState() {
      const length = input?.value.trim().length || 0;

      if (sendButton) {
        sendButton.disabled =
          busy ||
          lockedForLimit ||
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

    function clearConversation() {
      activeController?.abort();
      activeController = null;

      conversation = [];
      busy = false;
      lockedForLimit = false;
      lastSentAt = 0;

      if (input) {
        input.value = "";
        input.style.height = "auto";
      }

      renderWelcome();
      setStatus("ready", "A/L study assistant");
      updateSendState();
    }

    function closeAI() {
      /*
       * Closing the panel permanently clears the in-memory conversation.
       * No browser persistence and no database history are used.
       */
      clearConversation();
      setOpen(false);
    }

    async function sendQuestion() {
      if (!input || busy || lockedForLimit) return;

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

      conversation = [
        ...conversation,
        {
          role: "user",
          parts: [{ text: message }]
        }
      ].slice(-CONFIG.maxHistory);

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
        timeoutId = window.setTimeout(
          () => activeController?.abort(),
          32000
        );

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
          const error = new Error(
            data?.error || "The AI could not answer right now."
          );
          error.code = data?.code || "";
          error.remaining = data?.remaining;
          throw error;
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

        if (Number(data?.remaining) === 0) {
          lockedForLimit = true;
          setStatus("ready", "Daily AI limit reached");
        } else {
          setStatus("ready", "A/L study assistant");
        }
      } catch (error) {
        typing.remove();

        if (error?.name === "AbortError") {
          if (isOpen) {
            setStatus("error", "Request cancelled");
          }
        } else if (error?.code === "DAILY_LIMIT") {
          lockedForLimit = true;
          appendMessage(
            "model",
            "Daily AI limit reached. Please try again after the daily limit resets."
          );
          setStatus("error", "Daily AI limit reached");
        } else if (error?.code === "PROVIDER_LIMIT") {
          lockedForLimit = true;
          appendMessage(
            "model",
            "The AI service has reached its current limit. Please try again later."
          );
          setStatus("error", "AI limit reached");
        } else {
          appendMessage(
            "model",
            error?.message ||
              "Sorry, I couldn't get an answer right now. Please try again later."
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

    renderWelcome();
    setOpen(false);
    updateSendState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
