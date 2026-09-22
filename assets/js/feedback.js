/* =========================================================
   STUDY LAB — STUDENT FEEDBACK
   Uses the existing Supabase student account.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    table: "studylab_feedback",
    maxLength: 1200,
    cooldownMs: 15000
  };

  const FEEDBACK_MARKUP = `
    <div class="study-feedback" data-study-feedback>
      <button
        type="button"
        class="study-feedback-button"
        data-feedback-button
        aria-expanded="false"
        aria-controls="studyFeedbackPanel"
        aria-label="Open StudyLab feedback"
      >
        <span aria-hidden="true">💡</span>
        <span>Feedback</span>
      </button>

      <aside
        class="study-feedback-panel"
        id="studyFeedbackPanel"
        data-feedback-panel
        hidden
        aria-label="StudyLab feedback"
      >
        <div class="study-feedback-head">
          <div>
            <h2 class="study-feedback-title">Help improve StudyLab</h2>
            <p class="study-feedback-subtitle">Your feedback is sent directly to the StudyLab Supabase database.</p>
          </div>
          <button type="button" class="study-feedback-close" data-feedback-close aria-label="Close feedback">×</button>
        </div>

        <div class="study-feedback-options" role="group" aria-label="Feedback type">
          <button type="button" class="study-feedback-option active" data-feedback-category="bug">🐛 Report a problem</button>
          <button type="button" class="study-feedback-option" data-feedback-category="suggestion">💡 Suggest a tool</button>
          <button type="button" class="study-feedback-option" data-feedback-category="resource">📚 Request a resource</button>
        </div>

        <form class="study-feedback-form" data-feedback-form>
          <label class="study-feedback-label" for="studyFeedbackMessage">Message</label>
          <textarea
            id="studyFeedbackMessage"
            class="study-feedback-textarea"
            data-feedback-message
            maxlength="1200"
            placeholder="Tell us what you found or what would help your studies…"
            required
          ></textarea>

          <div class="study-feedback-meta">
            <span>Educational feedback only</span>
            <span data-feedback-count>0/1200</span>
          </div>

          <button type="submit" class="study-feedback-submit" data-feedback-submit>
            Send feedback
          </button>
          <div class="study-feedback-status" data-feedback-status aria-live="polite"></div>
        </form>
      </aside>
    </div>
  `;

  if (!document.querySelector("[data-study-feedback]")) {
    document.body.insertAdjacentHTML("beforeend", FEEDBACK_MARKUP);
  }

  const root = document.querySelector("[data-study-feedback]");
  if (!root) return;

  const button = root.querySelector("[data-feedback-button]");
  const panel = root.querySelector("[data-feedback-panel]");
  const closeButton = root.querySelector("[data-feedback-close]");
  const form = root.querySelector("[data-feedback-form]");
  const messageInput = root.querySelector("[data-feedback-message]");
  const submitButton = root.querySelector("[data-feedback-submit]");
  const status = root.querySelector("[data-feedback-status]");
  const charCount = root.querySelector("[data-feedback-count]");
  const options = [...root.querySelectorAll("[data-feedback-category]")];

  let category = "bug";
  let isOpen = false;
  let lastSentAt = 0;

  function setOpen(open) {
    isOpen = open;
    if (open) {
      window.dispatchEvent(new Event("studylab-feedback-open"));
    }
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.classList.toggle("is-open", open);

    if (open) {
      messageInput?.focus();
    }
  }

  function setStatus(text, type = "") {
    status.textContent = text;
    status.className = "study-feedback-status" + (type ? " " + type : "");
  }

  function updateCount() {
    const length = messageInput.value.length;
    charCount.textContent = length + "/" + CONFIG.maxLength;

    const canSend =
      length > 1 &&
      length <= CONFIG.maxLength &&
      Date.now() - lastSentAt >= CONFIG.cooldownMs;

    submitButton.disabled = !canSend;
  }

  function selectCategory(nextCategory) {
    category = nextCategory;
    options.forEach(option => {
      option.classList.toggle(
        "active",
        option.dataset.feedbackCategory === category
      );
    });
  }

  function closeOtherPanels() {
    const quickPanel = document.getElementById("studyQuickAccessPanel");
    const quickButton = document.getElementById("studyQuickButton");

    if (quickPanel && !quickPanel.hidden) {
      quickPanel.hidden = true;
      quickButton?.setAttribute("aria-expanded", "false");
      quickButton?.classList.remove("is-open");
    }

    const chatPanel = document.getElementById("studyChatPanel");
    const chatButton = document.querySelector("[data-chat-button]");

    if (chatPanel && !chatPanel.hidden) {
      chatPanel.hidden = true;
      chatButton?.setAttribute("aria-expanded", "false");
      chatButton?.classList.remove("is-open");
      window.dispatchEvent(new Event("studylab-feedback-open"));
    }
  }

  button?.addEventListener("click", event => {
    event.stopPropagation();
    closeOtherPanels();
    setOpen(!isOpen);
  });

  closeButton?.addEventListener("click", () => setOpen(false));
  panel?.addEventListener("click", event => event.stopPropagation());

  options.forEach(option => {
    option.addEventListener("click", () => {
      selectCategory(option.dataset.feedbackCategory);
      messageInput?.focus();
    });
  });

  messageInput?.addEventListener("input", updateCount);

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    const message = messageInput.value.trim();
    if (message.length < 2 || message.length > CONFIG.maxLength) {
      setStatus("Please enter a useful message.", "error");
      updateCount();
      return;
    }

    const account = window.StudyLabAccount;
    if (!account?.ready) {
      setStatus("Your StudyLab account is still starting. Please try again.", "error");
      return;
    }

    const now = Date.now();
    if (now - lastSentAt < CONFIG.cooldownMs) {
      return;
    }

    submitButton.disabled = true;
    setStatus("Sending…");

    try {
      await account.ready;
      const user = account.getUser?.();
      if (!user?.id) throw new Error("Student account unavailable.");

      const profile = await account.getProfile?.().catch(() => null);

      const { error } = await account.client
        .from(CONFIG.table)
        .insert({
          user_id: user.id,
          display_name: profile?.display_name || "",
          category,
          message,
          page_url: window.location.href.slice(0, 1000)
        });

      if (error) throw error;

      lastSentAt = now;
      messageInput.value = "";
      updateCount();
      setStatus("Thank you — your feedback was sent ✓", "success");

      window.setTimeout(() => {
        setOpen(false);
        setStatus("");
      }, 1000);

      window.setTimeout(updateCount, CONFIG.cooldownMs + 50);
    } catch (error) {
      console.warn("StudyLab Feedback:", error);
      setStatus("Could not send feedback right now. Please try again.", "error");
      updateCount();
    }
  });

  window.addEventListener("studylab-quick-open", () => {
    if (isOpen) setOpen(false);
  });

  window.addEventListener("studylab-chat-open", () => {
    if (isOpen) setOpen(false);
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
    if (event.key === "Escape" && isOpen) setOpen(false);
  });

  updateCount();
})();
