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

    async function getStudentAccessToken() {
      const account = window.StudyLabAccount;

      if (!account?.ready || !account?.client) {
        const error = new Error("StudyLab student account is unavailable.");
        error.code = "ACCOUNT_UNAVAILABLE";
        throw error;
      }

      await account.ready;

      const { data, error } = await account.client.auth.getSession();

      if (error || !data?.session?.access_token) {
        const sessionError = new Error(
          "Your StudyLab student account is not ready yet. Please refresh the page."
        );
        sessionError.code = "ACCOUNT_UNAVAILABLE";
        throw sessionError;
      }

      return data.session.access_token;
    }

    function scrollToBottom() {
      if (!list) return;
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function renderInlineMarkdown(source) {
      const mathTokens = [];
      const codeTokens = [];
      let text = String(source);

      text = text.replace(
        /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g,
        match => {
          const token = "\uE000M" + mathTokens.length + "\uE001";
          mathTokens.push(match);
          return token;
        }
      );

      text = text.replace(
        /\x60([^\x60\n]+)\x60/g,
        (_, value) => {
          const token = "\uE000C" + codeTokens.length + "\uE001";
          codeTokens.push(value);
          return token;
        }
      );

      text = escapeHtml(text);

      text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      text = text.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
      text = text.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
      text = text.replace(
        /(^|[\s([{"'])\*([^*\n]+)\*(?=$|[\s\])}.,!?;:])/g,
        "$1<em>$2</em>"
      );
      text = text.replace(
        /(^|[\s([{"'])_([^_\n]+)_(?=$|[\s\])}.,!?;:])/g,
        "$1<em>$2</em>"
      );

      text = text.replace(
        /&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi,
        "<u>$1</u>"
      );

      text = text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      text = text.replace(
        /\uE000C(\d+)\uE001/g,
        (_, index) => "<code>" + escapeHtml(codeTokens[Number(index)]) + "</code>"
      );

      text = text.replace(
        /\uE000M(\d+)\uE001/g,
        (_, index) => mathTokens[Number(index)]
      );

      return text;
    }

    function renderMarkdown(source) {
      const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
      let html = "";
      let inCode = false;
      let codeBuffer = [];
      let listType = null;
      const fence = String.fromCharCode(96).repeat(3);

      function closeList() {
        if (listType === "ul") html += "</ul>";
        if (listType === "ol") html += "</ol>";
        listType = null;
      }

      function addListItem(type, item) {
        if (listType !== type) {
          closeList();
          html += type === "ul" ? "<ul>" : "<ol>";
          listType = type;
        }
        html += "<li>" + renderInlineMarkdown(item) + "</li>";
      }

      for (const line of lines) {
        if (line.trim().startsWith(fence)) {
          if (inCode) {
            html += "<pre><code>" + escapeHtml(codeBuffer.join("\n")) + "</code></pre>";
            codeBuffer = [];
            inCode = false;
          } else {
            closeList();
            inCode = true;
          }
          continue;
        }

        if (inCode) {
          codeBuffer.push(line);
          continue;
        }

        const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
        const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
        const quote = line.match(/^\s*>\s?(.*)$/);

        if (!line.trim()) {
          closeList();
          html += "<br>";
          continue;
        }

        if (heading) {
          closeList();
          const level = heading[1].length;
          html += "<h" + level + ">" +
            renderInlineMarkdown(heading[2]) +
            "</h" + level + ">";
          continue;
        }

        if (bullet) {
          addListItem("ul", bullet[1]);
          continue;
        }

        if (numbered) {
          addListItem("ol", numbered[1]);
          continue;
        }

        if (quote) {
          closeList();
          html += "<blockquote>" +
            renderInlineMarkdown(quote[1]) +
            "</blockquote>";
          continue;
        }

        if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
          closeList();
          html += "<hr>";
          continue;
        }

        closeList();
        html += "<p>" + renderInlineMarkdown(line) + "</p>";
      }

      closeList();

      if (inCode && codeBuffer.length) {
        html += "<pre><code>" +
          escapeHtml(codeBuffer.join("\n")) +
          "</code></pre>";
      }

      return html;
    }

    let mathJaxPromise = null;

    function loadMathJax() {
      if (window.MathJax?.typesetPromise) {
        return Promise.resolve(window.MathJax);
      }

      if (mathJaxPromise) return mathJaxPromise;

      window.MathJax = window.MathJax || {
        tex: {
          inlineMath: [["$", "$"], ["\\(", "\\)"]],
          displayMath: [["$$", "$$"], ["\\[", "\\]"]]
        },
        options: {
          skipHtmlTags: [
            "script",
            "noscript",
            "style",
            "textarea",
            "pre",
            "code"
          ]
        }
      };

      mathJaxPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
        script.async = true;
        script.onload = () => resolve(window.MathJax);
        script.onerror = reject;
        document.head.appendChild(script);
      });

      return mathJaxPromise;
    }

    function typesetMath(element) {
      const source = element?.textContent || "";
      if (!element || !/[$]|\\\(|\\\[/.test(source)) return;

      loadMathJax()
        .then(() => window.MathJax.typesetPromise?.([element]))
        .catch(() => {});
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

      if (role === "model") {
        message.innerHTML = renderMarkdown(text);
        typesetMath(message);
      } else {
        message.textContent = text;
      }

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

        const accessToken = await getStudentAccessToken();

        const response = await fetch(CONFIG.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken
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
        } else if (error?.code === "ACCOUNT_UNAVAILABLE" || error?.code === "ACCOUNT_REQUIRED") {
          appendMessage(
            "model",
            "Your StudyLab student account is not ready yet. Please refresh the page and try again."
          );
          setStatus("error", "Account unavailable");
        } else if (error?.code === "QUOTA_SERVICE_UNAVAILABLE") {
          appendMessage(
            "model",
            "The StudyLab AI quota service is temporarily unavailable. Please try again later."
          );
          setStatus("error", "Quota service unavailable");
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
