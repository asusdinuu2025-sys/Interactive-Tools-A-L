/* =========================================================
   StudyLab Living Pet
   Global page-level companion. No simulation integration.
   ========================================================= */
(function () {
  "use strict";

  if (window.__StudyLabLivingPetLoaded) return;
  window.__StudyLabLivingPetLoaded = true;

  const STORAGE = {
    enabled: "studylab-pet-enabled",
    eye: "studylab-pet-eye"
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const now = () => Date.now();

  function readBool(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw === "true";
    } catch (_) {
      return fallback;
    }
  }

  function readEye() {
    try {
      return localStorage.getItem(STORAGE.eye) === "pink" ? "pink" : "cyan";
    } catch (_) {
      return "cyan";
    }
  }

  const state = {
    enabled: readBool(STORAGE.enabled, true),
    eye: readEye(),
    context: "home",
    mood: "idle",
    sleeping: false,
    dragging: false,
    dragged: false,
    pointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    pointerStartX: 0,
    pointerStartY: 0,
    lastActivity: now(),
    lastReaction: 0,
    lastBlink: now(),
    nextBlinkAt: now() + 10500,
    lastAmbient: now(),
    lastMove: now(),
    lastHover: 0,
    anger: 0,
    x: Math.min(window.innerWidth - 90, Math.max(90, window.innerWidth * 0.72)),
    y: Math.min(window.innerHeight - 120, Math.max(110, window.innerHeight * 0.56)),
    gazeTargetX: 0,
    gazeTargetY: 0,
    gazeX: 0,
    gazeY: 0,
    wanderTimer: null,
    messageTimer: null,
    nameTimer: null,
    microTimer: null,
    moveTimer: null,
    expressionKey: "idle"
  };

  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = "assets/css/studylab-pet.css";
  document.head.appendChild(styleLink);

  document.body.insertAdjacentHTML("beforeend", `
    <div id="studylabPetStage" aria-hidden="false">
      <div
        class="sl-pet-character"
        data-state="idle"
        data-eye="cyan"
        role="button"
        tabindex="0"
        aria-label="StudyLab Pet"
      >
        <div class="sl-pet-face" aria-hidden="true">
          <div class="sl-pet-eye left"><i></i></div>
          <div class="sl-pet-eye right"><i></i></div>
          <div class="sl-pet-mouth"></div>
          <span class="sl-pet-sleep-z z1">Z</span>
          <span class="sl-pet-sleep-z z2">z</span>
          <span class="sl-pet-sleep-z z3">z</span>
          <span class="sl-pet-crack" aria-hidden="true"></span>
        </div>
      </div>
      <div class="sl-pet-bubble" data-pet-bubble role="status" aria-live="polite"></div>
    </div>

    <button
      id="studylabPetLauncher"
      type="button"
      aria-expanded="false"
      aria-controls="studylabPetPanel"
      title="StudyLab Pet controls"
    >
      <span class="sl-pet-launcher-icon" aria-hidden="true">🤖</span>
      <span>Pet</span>
    </button>

    <aside
      class="sl-pet-panel"
      id="studylabPetPanel"
      hidden
      aria-label="StudyLab Pet controls"
    >
      <div class="sl-pet-panel-head">
        <div>
          <strong>StudyLab Pet</strong>
          <small>Your little study companion</small>
        </div>
        <button
          class="sl-pet-panel-close"
          type="button"
          data-pet-close
          aria-label="Close pet controls"
        >×</button>
      </div>

      <div class="sl-pet-setting">
        <span>Pet</span>
        <div class="sl-pet-setting-buttons" role="group" aria-label="Pet enabled state">
          <button type="button" data-pet-enable>Enable</button>
          <button type="button" data-pet-disable>Disable</button>
        </div>
      </div>

      <div class="sl-pet-setting">
        <span>Eye colour</span>
        <div class="sl-pet-setting-buttons" role="group" aria-label="Pet eye colour">
          <button type="button" data-pet-eye="cyan">Cyan</button>
          <button type="button" data-pet-eye="pink">Pink</button>
        </div>
      </div>

      <p class="sl-pet-panel-note">
        A small page companion that watches the cursor, wanders gently, reacts to StudyLab,
        and sleeps when the page is quiet.
      </p>
    </aside>
  `);

  const stage = document.getElementById("studylabPetStage");
  const character = stage.querySelector(".sl-pet-character");
  const bubble = stage.querySelector("[data-pet-bubble]");
  const eyes = [...stage.querySelectorAll(".sl-pet-eye > i")];
  const eyeShells = [...stage.querySelectorAll(".sl-pet-eye")];

  const launcher = document.getElementById("studylabPetLauncher");
  const panel = document.getElementById("studylabPetPanel");
  const closeButton = panel.querySelector("[data-pet-close]");
  const enableButton = panel.querySelector("[data-pet-enable]");
  const disableButton = panel.querySelector("[data-pet-disable]");
  const eyeButtons = [...panel.querySelectorAll("[data-pet-eye]")];

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE.enabled, String(state.enabled));
      localStorage.setItem(STORAGE.eye, state.eye);
    } catch (_) {}
  }

  function pageContext() {
    const path = location.pathname.toLowerCase();
    const title = (document.title || "").toLowerCase();
    const text = (document.body?.innerText || "").slice(0, 6000).toLowerCase();

    if (path.includes("study-tools")) return "study";
    if (path.includes("physics")) return "physics";
    if (path.includes("chemistry")) return "chemistry";
    if (path.includes("maths")) return "maths";
    if (path.includes("biology")) return "biology";
    if (path.includes("exam-hub")) return "exam";
    if (path.includes("telegram")) return "social";

    if (/physics/.test(title + text)) return "physics";
    if (/chemistry/.test(title + text)) return "chemistry";
    if (/mathematics|combined maths|combined mathematics/.test(title + text)) return "maths";
    if (/biology/.test(title + text)) return "biology";
    if (/past papers|marking schemes|exam hub/.test(title + text)) return "exam";
    return "home";
  }

  state.context = pageContext();

  const messages = {
    home: {
      hover: ["👀", "Hmm.", "..."],
      click: ["Got it.", "I saw that."]
    },
    physics: {
      hover: ["Physics.", "Watching.", "Interesting."]
    },
    chemistry: {
      hover: ["🧪", "Lab mode.", "Watching."]
    },
    maths: {
      hover: ["📐", "Numbers.", "Calculating."]
    },
    biology: {
      hover: ["🧬", "Observing.", "Interesting."]
    },
    study: {
      hover: ["Focus.", "Study mode.", "Watching the tools."]
    },
    exam: {
      hover: ["Exam mode.", "Serious.", "Paper hunt."]
    },
    social: {
      hover: ["👀", "Community.", "I see."]
    }
  };

  function utilityKind(el) {
    const value = [
      el.id || "",
      el.getAttribute("href") || "",
      el.getAttribute("aria-label") || "",
      el.textContent || ""
    ].join(" ").toLowerCase();

    if (/pomodoro|focus timer/.test(value)) return "pomodoro";
    if (/flashcard|flash card/.test(value)) return "flashcard";
    if (/mistake notebook|mistake/.test(value)) return "mistake";
    if (/marks calculator|marks/.test(value)) return "marks";
    if (/study.?time|study planner|planner/.test(value)) return "planner";
    if (/mock exam|exam timer/.test(value)) return "mock";
    if (/unit converter|converter/.test(value)) return "converter";
    return "";
  }

  function elementContext(el) {
    const value = [
      el.id || "",
      el.className || "",
      el.getAttribute("href") || "",
      el.getAttribute("aria-label") || "",
      el.textContent || ""
    ].join(" ").toLowerCase();

    if (/study tools|study utilities|pomodoro|flashcard|mistake|planner|converter|marks calculator/.test(value)) return "study";
    if (/physics|doppler|gravity|gravitational|projectile|wave|electricity/.test(value)) return "physics";
    if (/chemistry|රසායන|practical|organic|inorganic/.test(value)) return "chemistry";
    if (/maths|mathematics|සංයුක්ත ගණිතය|trigonometry|calculus|vector/.test(value)) return "maths";
    if (/biology|ජීව|genetics|cell structure/.test(value)) return "biology";
    if (/exam|past paper|marking scheme|model paper|school paper|timetable/.test(value)) return "exam";
    if (/telegram|community|channel/.test(value)) return "social";
    return state.context;
  }

  function setStagePosition(x, y, options = {}) {
    const marginX = window.innerWidth <= 720 ? 52 : 62;
    const marginTop = 76;
    const marginBottom = 82;

    const nextX = Math.max(marginX, Math.min(window.innerWidth - marginX, x));
    const nextY = Math.max(marginTop, Math.min(window.innerHeight - marginBottom, y));

    if (!options.drag) {
      const dx = nextX - state.x;
      const dy = nextY - state.y;

      if (Math.hypot(dx, dy) > 16) {
        const upward = dy < -14;
        const downward = dy > 14;

        state.lastMove = now();

        character.style.setProperty(
          "--pet-move-duration",
          upward ? "3600ms" : downward ? "1500ms" : "2900ms"
        );

        character.style.setProperty(
          "--pet-move-ease",
          upward
            ? "cubic-bezier(.24,.56,.16,1)"
            : downward
              ? "cubic-bezier(.14,.88,.24,1.08)"
              : "cubic-bezier(.20,.72,.20,1)"
        );

        character.classList.remove("is-moving", "is-climbing", "is-falling", "is-landed");

        if (upward) character.classList.add("is-climbing");
        else if (downward) character.classList.add("is-falling");
        else character.classList.add("is-moving");

        if (downward) {
          window.clearTimeout(state.moveTimer);
          state.moveTimer = window.setTimeout(() => {
            if (!state.dragging && state.enabled) {
              character.classList.remove("is-falling");
              character.classList.add("is-landed");
              window.setTimeout(() => character.classList.remove("is-landed"), 550);
            }
          }, 1550);
        }
      }
    }

    state.x = nextX;
    state.y = nextY;
    character.style.left = nextX + "px";
    character.style.top = nextY + "px";
    bubble.style.left = nextX + "px";
    bubble.style.top = Math.max(80, nextY - 36) + "px";
  }

  function randomWanderTarget() {
    const maxDistance = state.context === "study" ? 105 : 82;
    const angle = Math.random() * Math.PI * 2;
    const distance = maxDistance * (0.45 + Math.random() * 0.55);

    return {
      x: state.x + Math.cos(angle) * distance,
      y: state.y + Math.sin(angle) * distance * 0.72
    };
  }

  function scheduleWander(delay) {
    window.clearTimeout(state.wanderTimer);

    state.wanderTimer = window.setTimeout(() => {
      if (!state.enabled || state.sleeping || state.dragging || document.hidden) {
        scheduleWander(state.sleeping ? 6000 : 5000);
        return;
      }

      const target = randomWanderTarget();
      setStagePosition(target.x, target.y);

      const nextDelay = state.context === "study"
        ? 15000 + Math.random() * 10000
        : 23000 + Math.random() * 15000;

      scheduleWander(nextDelay);
    }, delay);
  }

  function showMessage(message, duration = 1500) {
    if (!state.enabled) return;

    bubble.textContent = message;
    bubble.classList.add("is-visible");

    window.clearTimeout(state.messageTimer);
    state.messageTimer = window.setTimeout(() => {
      bubble.classList.remove("is-visible");
    }, duration);
  }

  function applyMood(mood) {
    if (!state.enabled) return;

    const next = mood || "idle";
    state.mood = next;
    state.expressionKey = next;
    character.dataset.state = state.sleeping ? "sleeping" : next;
  }

  function settleMood() {
    if (state.sleeping || state.dragging || !state.enabled) return;

    if (state.context === "study" && now() - state.lastActivity > 5000) {
      applyMood("focused");
    } else {
      applyMood("idle");
    }
  }

  function react(type, detail = {}, force = false) {
    if (!state.enabled && !force) return;

    const timestamp = now();
    if (!force && timestamp - state.lastReaction < 600) return;

    state.lastReaction = timestamp;
    state.lastActivity = timestamp;
    state.sleeping = false;

    switch (type) {
      case "wake":
        applyMood("sleepy");
        window.setTimeout(() => {
          if (state.enabled && !state.sleeping) applyMood("curious");
        }, 480);
        return;

      case "hover-card": {
        const context = detail.context || state.context;
        if (context === "study") applyMood("focused");
        else applyMood("curious");

        const utility = detail.element ? utilityKind(detail.element) : "";
        if (utility === "pomodoro") applyMood("focused");
        else if (utility === "marks") applyMood("surprised");
        else if (utility === "mistake") applyMood("confused");

        const pool = messages[context]?.hover;
        if (pool && Math.random() < 0.16) {
          showMessage(pool[Math.floor(Math.random() * pool.length)], 1200);
        }
        return;
      }

      case "click-card": {
        const context = detail.context || state.context;
        const utility = detail.element ? utilityKind(detail.element) : "";

        if (context === "study") {
          if (utility === "pomodoro" || utility === "mock") applyMood("focused");
          else if (utility === "marks") applyMood("surprised");
          else if (utility === "mistake") applyMood("confused");
          else if (utility === "flashcard") applyMood("curious");
          else applyMood("focused");
        } else if (context === "chemistry") applyMood("excited");
        else if (context === "physics") applyMood("curious");
        else if (context === "maths") applyMood("thinking");
        else if (context === "biology") applyMood("happy");
        else if (context === "exam") applyMood("focused");
        else applyMood("happy");

        return;
      }

      case "typing":
        applyMood("curious");
        if (detail.name && Math.random() < 0.20) {
          showMessage("👀", 1100);
        }
        return;

      case "name-complete":
        applyMood("happy");
        showMessage("👋", 1200);
        return;

      case "theme":
        applyMood("surprised");
        return;

      case "scroll":
        applyMood("curious");
        return;

      case "scared":
        applyMood("scared");
        return;

      case "anger":
        state.anger += 1;
        applyMood("angry");
        if (state.anger >= 2 && Math.random() < 0.45) {
          showMessage("...", 1000);
        }

        window.setTimeout(() => {
          if (state.enabled && !state.dragging && !state.sleeping) settleMood();
        }, 1500);
        return;

      case "micro":
        if (state.context === "study") {
          applyMood(["focused","thinking","curious","unimpressed"][Math.floor(Math.random() * 4)]);
        } else {
          applyMood(["idle","curious","bored","thinking"][Math.floor(Math.random() * 4)]);
        }

        window.setTimeout(() => {
          if (state.enabled && !state.sleeping && !state.dragging) settleMood();
        }, 1200);
        return;

      default:
        applyMood("idle");
    }
  }

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging || now() < state.nextBlinkAt) return;

    state.lastBlink = now();
    state.nextBlinkAt = now() + 9000 + Math.random() * 4000;

    eyeShells.forEach((eye) => {
      eye.style.height = "4px";
      eye.style.top = "12px";
    });

    window.setTimeout(() => {
      if (state.sleeping || state.dragging || !state.enabled) return;
      eyeShells.forEach((eye) => {
        eye.style.height = "";
        eye.style.top = "";
      });
    }, 180);
  }

  function gazeAt(x, y) {
    const rect = character.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    state.gazeTargetX = Math.max(-1, Math.min(1, (x - centerX) / 190)) * 5.5;
    state.gazeTargetY = Math.max(-1, Math.min(1, (y - centerY) / 145)) * 4.8;
  }

  function gazeLoop() {
    if (state.enabled) {
      state.gazeX += (state.gazeTargetX - state.gazeX) * 0.075;
      state.gazeY += (state.gazeTargetY - state.gazeY) * 0.075;

      character.style.setProperty("--gaze-x", state.gazeX.toFixed(2) + "px");
      character.style.setProperty("--gaze-y", state.gazeY.toFixed(2) + "px");
    }

    requestAnimationFrame(gazeLoop);
  }

  function handlePointerMove(event) {
    if (!state.enabled) return;

    state.lastActivity = now();
    gazeAt(event.clientX, event.clientY);

    if (state.sleeping) {
      state.sleeping = false;
      react("wake", {}, true);
    }

    if (!state.dragging) {
      const distance = Math.hypot(
        event.clientX - state.x,
        event.clientY - state.y
      );

      if (distance < 82 && now() - state.lastReaction > 1400) {
        applyMood("curious");
      }
    }
  }

  function handleCardHover(event) {
    if (!state.enabled) return;

    const card = event.target.closest?.(
      ".subject-card,.study-tools-card,.telegram-card,.utility-card,.tool-card,.student-counter,.live-card,.homepage-utility-card"
    );

    if (!card || card.contains(event.relatedTarget)) return;
    if (now() - state.lastHover < 1400) return;

    state.lastHover = now();
    state.lastActivity = now();
    react("hover-card", {
      context: elementContext(card),
      element: card
    });
  }

  function handleGlobalClick(event) {
    if (!state.enabled) return;

    const target = event.target.closest?.("a,button,[role='button']");
    if (!target) return;
    if (character.contains(target) || panel.contains(target) || target === launcher) return;

    const label = (
      target.id + " " +
      target.textContent + " " +
      target.getAttribute("aria-label")
    ).toLowerCase();

    if (/theme|dark mode|light mode/.test(label)) {
      react("theme");
      return;
    }

    const context = elementContext(target);
    const utility = utilityKind(target);

    if (
      target.matches(
        ".subject-card,.study-tools-card,.telegram-card,.utility-card,.tool-card,.live-card"
      ) ||
      utility
    ) {
      react("click-card", { context, element: target });
    }
  }

  function handleTyping(event) {
    if (!state.enabled) return;

    const target = event.target;
    if (!(target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)) return;

    state.lastActivity = now();

    if (target.id === "profileName" || target.name === "name") {
      const value = (target.value || "").trim();

      react("typing", { name: value });

      window.clearTimeout(state.nameTimer);

      if (value.length >= 2) {
        state.nameTimer = window.setTimeout(() => {
          if (String(target.value || "").trim() === value) {
            react("name-complete", { name: value });
          }
        }, 1200);
      }
    }
  }

  function handleKeydown(event) {
    if (!state.enabled) return;

    state.lastActivity = now();

    if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter" || event.key === "Backspace" || event.key.length === 1) {
      if (now() - state.lastReaction > 1600) applyMood("curious");
    }
  }

  function handleFocus(event) {
    if (!state.enabled) return;
    if (event.target.matches?.("input,textarea,select")) {
      applyMood("curious");
      state.lastActivity = now();
    }
  }

  function handleScroll() {
    if (!state.enabled) return;
    state.lastActivity = now();

    if (now() - state.lastReaction > 1400) {
      react("scroll");
    }
  }

  function handlePetPointerDown(event) {
    if (!state.enabled) return;

    const rect = character.getBoundingClientRect();

    state.dragging = true;
    state.dragged = false;
    state.pointerId = event.pointerId;
    state.pointerStartX = event.clientX;
    state.pointerStartY = event.clientY;
    state.dragOffsetX = event.clientX - (rect.left + rect.width / 2);
    state.dragOffsetY = event.clientY - (rect.top + rect.height / 2);
    state.sleeping = false;

    character.setPointerCapture?.(event.pointerId);
    character.classList.add("is-dragging");

    react("scared", {}, true);

    event.preventDefault();
    event.stopPropagation();
  }

  function handlePetPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;

    const moved = Math.hypot(
      event.clientX - state.pointerStartX,
      event.clientY - state.pointerStartY
    );

    if (moved > 6) state.dragged = true;
    if (!state.dragged) return;

    state.lastActivity = now();

    setStagePosition(
      event.clientX - state.dragOffsetX,
      event.clientY - state.dragOffsetY,
      { drag: true }
    );

    gazeAt(event.clientX, event.clientY);
  }

  function finishPetPointer(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;

    const didDrag = state.dragged;

    state.dragging = false;
    state.pointerId = null;
    character.classList.remove("is-dragging");
    character.classList.remove("is-moving", "is-climbing", "is-falling");

    try {
      character.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    if (didDrag) {
      state.lastActivity = now();
      character.classList.add("is-landed");
      applyMood("scared");
      showMessage("😳", 1100);

      window.setTimeout(() => {
        character.classList.remove("is-landed");
        if (state.enabled && !state.sleeping) settleMood();
      }, 550);
    } else {
      react("anger", {}, true);
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function closeOtherPanels() {
    const feedbackPanel = document.querySelector("[data-feedback-panel]");
    const feedbackButton = document.querySelector("[data-feedback-button]");
    if (feedbackPanel && !feedbackPanel.hidden) {
      feedbackPanel.hidden = true;
      feedbackButton?.setAttribute("aria-expanded", "false");
      feedbackButton?.classList.remove("is-open");
    }

    const chatPanel = document.getElementById("studyChatPanel");
    const chatButton = document.querySelector("[data-chat-button]");
    if (chatPanel && !chatPanel.hidden) {
      chatPanel.hidden = true;
      chatButton?.setAttribute("aria-expanded", "false");
      chatButton?.classList.remove("is-open");
    }
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    state.sleeping = false;

    if (!state.enabled) {
      bubble.classList.remove("is-visible");
      character.dataset.state = "idle";
      character.classList.remove("is-moving", "is-climbing", "is-falling", "is-landed", "is-dragging");
      window.clearTimeout(state.wanderTimer);
      window.clearTimeout(state.messageTimer);
    } else {
      state.context = pageContext();
      state.lastActivity = now();
      state.nextBlinkAt = now() + 10000;
      applyMood("curious");
      showMessage("👀", 1100);
      scheduleWander(9000);
    }

    updateControls();
    savePrefs();
  }

  function setEye(eye) {
    state.eye = eye === "pink" ? "pink" : "cyan";
    updateControls();
    savePrefs();

    if (state.enabled) {
      applyMood("happy");
      window.setTimeout(settleMood, 850);
    }
  }

  function updateControls() {
    stage.classList.toggle("is-disabled", !state.enabled);
    character.dataset.eye = state.eye;

    enableButton.classList.toggle("is-active", state.enabled);
    disableButton.classList.toggle("is-active", !state.enabled);

    eyeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });
  }

  launcher.addEventListener("click", (event) => {
    closeOtherPanels();
    event.stopPropagation();
    setOpen(panel.hidden);
  });

  closeButton.addEventListener("click", () => setOpen(false));

  enableButton.addEventListener("click", () => {
    setEnabled(true);
    setOpen(false);
  });

  disableButton.addEventListener("click", () => {
    setEnabled(false);
    setOpen(false);
  });

  eyeButtons.forEach((button) => {
    button.addEventListener("click", () => setEye(button.dataset.petEye));
  });

  character.addEventListener("pointerdown", handlePetPointerDown);
  character.addEventListener("pointermove", handlePetPointerMove);
  character.addEventListener("pointerup", finishPetPointer);
  character.addEventListener("pointercancel", finishPetPointer);

  character.addEventListener("keydown", (event) => {
    if (!state.enabled) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      react("anger", {}, true);
    }
  });

  document.addEventListener("mousemove", handlePointerMove, { passive: true });
  document.addEventListener("pointerover", handleCardHover, { passive: true });
  document.addEventListener("click", handleGlobalClick, true);
  document.addEventListener("input", handleTyping, { passive: true });
  document.addEventListener("focusin", handleFocus);
  document.addEventListener("scroll", handleScroll, { passive: true });
  document.addEventListener("keydown", handleKeydown);

  document.addEventListener("click", (event) => {
    if (
      !panel.hidden &&
      !panel.contains(event.target) &&
      event.target !== launcher &&
      !launcher.contains(event.target)
    ) {
      setOpen(false);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!state.enabled) return;

    if (document.hidden) {
      state.sleeping = true;
      character.dataset.state = "sleeping";
      bubble.classList.remove("is-visible");
    } else {
      state.sleeping = false;
      state.lastActivity = now();
      react("wake", {}, true);
    }
  });

  window.addEventListener("resize", () => {
    setStagePosition(state.x, state.y, { drag: true });
  }, { passive: true });

  window.addEventListener("studylab-profile-updated", (event) => {
    const name = event.detail?.display_name || "";
    if (state.enabled && name) react("name-complete", { name });
  });

  const themeButton = document.querySelector("[data-theme-toggle]");
  themeButton?.addEventListener("click", () => react("theme"));

  const observer = new MutationObserver(() => {
    if (!state.enabled) return;

    const current = pageContext();
    if (current !== state.context) {
      state.context = current;

      if (current === "study" || current === "exam") applyMood("focused");
      else applyMood("curious");

      window.clearTimeout(state.wanderTimer);
      scheduleWander(current === "study" ? 6000 : 9000);
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "hidden"]
  });

  function activityLoop() {
    if (state.enabled && !state.dragging && !document.hidden) {
      const idleMs = now() - state.lastActivity;

      if (idleMs >= 7000 && !state.sleeping) {
        state.sleeping = true;
        character.dataset.state = "sleeping";
        showMessage("Zzz...", 1400);
        window.clearTimeout(state.wanderTimer);
      }

      if (!state.sleeping && !reducedMotion) {
        blink();

        const microGap = state.context === "study" ? 17000 : 22000;
        if (now() - state.lastAmbient > microGap) {
          state.lastAmbient = now();

          if (Math.random() < 0.42) {
            react("micro");
          }
        }
      }
    }

    window.setTimeout(activityLoop, 900);
  }

  updateControls();
  setStagePosition(state.x, state.y, { drag: true });
  state.lastActivity = now();

  if (state.enabled) {
    applyMood("idle");
    window.setTimeout(() => react("wake", {}, true), 900);
    scheduleWander(9500);
  }

  gazeLoop();
  activityLoop();

  window.setInterval(() => {
    if (state.anger > 0 && now() - state.lastReaction > 7000) {
      state.anger = Math.max(0, state.anger - 1);
    }
  }, 2500);
})();
