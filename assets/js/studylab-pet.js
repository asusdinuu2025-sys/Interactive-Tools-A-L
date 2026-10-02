/* =========================================================
   StudyLab Living Pet
   Global page-level companion. Intentionally does not integrate
   with simulation internals.
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
  const getNow = () => Date.now();

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
    pointerStartX: 0,
    pointerStartY: 0,
    lastActivity: getNow(),
    lastReaction: 0,
    lastAmbient: 0,
    lastBlink: getNow(),
    anger: 0,
    x: Math.min(window.innerWidth - 90, Math.max(90, window.innerWidth * 0.72)),
    y: Math.min(window.innerHeight - 120, Math.max(100, window.innerHeight * 0.56)),
    targetX: null,
    targetY: null,
    gazeX: 0,
    gazeY: 0,
    wanderTimer: null,
    messageTimer: null,
    nameTimer: null
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
        It follows your cursor, wanders around the page, sleeps when you're inactive,
        and reacts to different StudyLab areas.
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
    const text = (document.body?.innerText || "").slice(0, 6500).toLowerCase();

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

  const contextMessages = {
    home: {
      hover: ["👀 I noticed that.", "Hmm... interesting.", "I'm watching."],
      click: ["Got it.", "I saw that.", "Moving on."]
    },
    physics: {
      hover: ["Physics detected. 👀", "Watching the motion.", "Something is moving..."],
      click: ["Physics engaged ⚛️", "Interesting.", "Following this."]
    },
    chemistry: {
      hover: ["Chemistry? 🧪", "Lab mode: curious.", "Something is reacting..."],
      click: ["Reaction noted. 🧪", "Chemistry mode.", "Keep going."]
    },
    maths: {
      hover: ["Maths time. 📐", "Numbers detected.", "Keeping an eye on this."],
      click: ["Calculating...", "Maths engaged.", "I respect the numbers."]
    },
    biology: {
      hover: ["Biology! 🧬", "Observing closely.", "Curious about this."],
      click: ["Biology mode. 🧬", "Noted.", "Observing."]
    },
    exam: {
      hover: ["Exam territory.", "Paper hunt detected.", "Serious mode."],
      click: ["Locking in.", "One paper at a time.", "Noted."]
    },
    social: {
      hover: ["Student community detected.", "Telegram territory. 👀", "I see where you're going."],
      click: ["Community mode.", "Noted.", "I saw that."]
    },
    study: {
      hover: ["Study mode activated.", "Focus detected.", "I'm watching the tools."],
      click: ["Study tools. Let's work.", "Focus mode.", "I'm keeping watch."]
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
    if (/graph|trigonometry|quadratic|calculus/.test(value)) return "math";
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

  function setStagePosition(x, y, opts = {}) {
    const marginX = window.innerWidth <= 720 ? 52 : 66;
    const marginTop = 72;
    const marginBottom = 82;

    const nextX = Math.max(marginX, Math.min(window.innerWidth - marginX, x));
    const nextY = Math.max(marginTop, Math.min(window.innerHeight - marginBottom, y));

    if (!opts.drag) {
      const dx = nextX - state.x;
      const dy = nextY - state.y;

      if (Math.hypot(dx, dy) > 10) {
        const upward = dy < -10;
        const downward = dy > 10;

        character.style.setProperty(
          "--pet-move-duration",
          upward ? "1120ms" : downward ? "520ms" : "760ms"
        );
        character.style.setProperty(
          "--pet-move-ease",
          upward
            ? "cubic-bezier(.22,.68,.18,1)"
            : downward
              ? "cubic-bezier(.15,.9,.28,1.25)"
              : "cubic-bezier(.22,.78,.2,1)"
        );

        character.classList.remove("is-walking", "is-climbing", "is-falling", "is-landed");

        if (upward) {
          character.classList.add("is-climbing");
        } else if (downward) {
          character.classList.add("is-falling");
        } else {
          character.classList.add("is-walking");
        }

        if (downward) {
          window.setTimeout(() => {
            if (!state.dragging) {
              character.classList.remove("is-falling");
              character.classList.add("is-landed");
              window.setTimeout(() => character.classList.remove("is-landed"), 480);
            }
          }, 530);
        }
      }
    }

    state.x = nextX;
    state.y = nextY;
    character.style.left = nextX + "px";
    character.style.top = nextY + "px";
    bubble.style.left = nextX + "px";
    bubble.style.top = Math.max(78, nextY - 34) + "px";
  }

  function randomWanderTarget() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const maxMove = state.context === "study" ? 165 : 125;
    const x = Math.max(70, Math.min(width - 70, state.x + (Math.random() * 2 - 1) * maxMove));
    const y = Math.max(88, Math.min(height - 120, state.y + (Math.random() * 2 - 1) * maxMove * 0.72));

    return { x, y };
  }

  function scheduleWander(delay) {
    window.clearTimeout(state.wanderTimer);
    state.wanderTimer = window.setTimeout(() => {
      if (!state.enabled || state.sleeping || state.dragging || document.hidden) {
        scheduleWander(2600);
        return;
      }

      const target = randomWanderTarget();
      state.targetX = target.x;
      state.targetY = target.y;

      setStagePosition(target.x, target.y);
      scheduleWander(
        state.context === "study"
          ? 9000 + Math.random() * 6500
          : 13000 + Math.random() * 10000
      );
    }, delay);
  }

  function showMessage(message, duration = 1900) {
    if (!state.enabled) return;

    bubble.textContent = message;
    bubble.classList.add("is-visible");
    window.clearTimeout(state.messageTimer);
    state.messageTimer = window.setTimeout(() => {
      bubble.classList.remove("is-visible");
    }, duration);
  }

  function setMood(mood, ttl = 1100) {
    if (!state.enabled) return;

    state.mood = mood;
    character.dataset.state = state.sleeping ? "sleeping" : mood;

    if (ttl === 0) return;

    window.setTimeout(() => {
      if (state.sleeping || state.dragging) return;
      state.mood =
        state.context === "study" && getNow() - state.lastActivity > 7000
          ? "focused"
          : "idle";
      character.dataset.state = state.mood;
    }, ttl);
  }

  function updateControls() {
    stage.classList.toggle("is-disabled", !state.enabled);
    character.dataset.eye = state.eye;

    enableButton.classList.toggle("is-active", state.enabled);
    disableButton.classList.toggle("is-active", !state.enabled);

    eyeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });

    launcher.setAttribute("aria-expanded", String(!panel.hidden));
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
  }

  function setEye(eye) {
    state.eye = eye === "pink" ? "pink" : "cyan";
    updateControls();
    savePrefs();

    if (state.enabled) {
      setMood("happy", 850);
      showMessage(
        state.eye === "pink" ? "Pink mode. 🩷" : "Cyan mode. 🩵",
        1400
      );
    }
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    state.sleeping = false;

    if (!state.enabled) {
      bubble.classList.remove("is-visible");
      character.dataset.state = "idle";
      character.classList.remove("is-walking", "is-climbing", "is-falling", "is-landed");
    } else {
      state.lastActivity = getNow();
      state.context = pageContext();
      setMood("curious", 900);
      showMessage("I'm back. 👀", 1500);
    }

    updateControls();
    savePrefs();
  }

  function react(type, detail = {}, force = false) {
    if (!state.enabled && !force) return;

    const now = getNow();
    if (!force && now - state.lastReaction < 320) return;

    state.lastReaction = now;
    state.lastActivity = now;
    state.sleeping = false;

    if (type === "wake") {
      setMood("curious", 900);
      showMessage("I'm awake. 👀", 1400);
      return;
    }

    if (type === "hover-card") {
      const context = detail.context || state.context;
      const profile = contextMessages[context] || contextMessages.home;
      const message = profile.hover[Math.floor(Math.random() * profile.hover.length)];

      const utility = detail.element ? utilityKind(detail.element) : "";
      if (context === "study" && utility) {
        const utilityMessages = {
          pomodoro: ["Focus timer noticed. ⏱️", "Pomodoro mode.", "Lock in."],
          flashcard: ["Flashcards. Flip away.", "Watching the cards.", "Memory mode. 👀"],
          mistake: ["Mistake notebook detected.", "Fixing mistakes is useful.", "I saw that entry."],
          marks: ["Marks calculator?", "Let's see the numbers.", "Calculating..."],
          planner: ["Planning study time.", "Schedule detected.", "Organized. Respect."],
          mock: ["Mock exam mode.", "Serious face activated.", "Exam simulation noticed."],
          converter: ["Unit conversion.", "Numbers changing units.", "Converter spotted."]
        };
        const pool = utilityMessages[utility];
        if (pool) showMessage(pool[Math.floor(Math.random() * pool.length)], 1900);
      } else {
        showMessage(message, 1900);
      }

      setMood(context === "study" || context === "exam" ? "focused" : "curious", 1150);
      return;
    }

    if (type === "click-card") {
      const context = detail.context || state.context;
      const profile = contextMessages[context] || contextMessages.home;
      const utility = detail.element ? utilityKind(detail.element) : "";

      if (context === "study" && utility === "pomodoro") {
        setMood("focused", 2200);
        showMessage("Focus mode. No excuses. ⏱️", 2100);
      } else if (context === "study" && utility === "flashcard") {
        setMood("curious", 1300);
        showMessage("Flip it.", 1200);
      } else if (context === "study" && utility === "mistake") {
        setMood("confused", 1350);
        showMessage("Good. Fix the mistake.", 1800);
      } else {
        showMessage(profile.click[Math.floor(Math.random() * profile.click.length)], 1650);
        setMood(context === "study" || context === "exam" ? "focused" : "happy", 1100);
      }
      return;
    }

    if (type === "typing") {
      setMood("curious", 820);
      showMessage(detail.name ? "That name got my attention. 👀" : "What are you typing?", 1500);
      return;
    }

    if (type === "name-complete") {
      setMood("happy", 1250);
      showMessage(
        detail.name ? "Nice to meet you, " + detail.name + "." : "I saw that.",
        2100
      );
      return;
    }

    if (type === "theme") {
      setMood("curious", 800);
      showMessage("New lighting.", 1200);
      return;
    }

    if (type === "scroll") {
      setMood("curious", 550);
      return;
    }

    if (type === "anger") {
      state.anger += 1;
      setMood("angry", 1150);

      if (state.anger === 1) showMessage("Hey. Easy.", 1450);
      else if (state.anger === 2) showMessage("Stop poking me. 😑", 1650);
      else if (state.anger === 3) showMessage("I was sleeping, you know.", 1850);
      else showMessage("I'm ignoring you for a moment.", 2000);

      const away = {
        x: Math.max(70, Math.min(window.innerWidth - 70, state.x + (Math.random() < .5 ? -120 : 120))),
        y: Math.max(90, Math.min(window.innerHeight - 120, state.y + (Math.random() < .5 ? -25 : 25)))
      };
      window.setTimeout(() => {
        if (state.enabled && !state.dragging) setStagePosition(away.x, away.y);
      }, 480);
      return;
    }

    if (type === "scared") {
      setMood("scared", 1100);
      showMessage("Hey! 😳", 1500);
      return;
    }

    if (type === "late-night") {
      setMood("sleeping", 0);
      state.sleeping = true;
      character.dataset.state = "sleeping";
      showMessage("It's late... Zzz.", 1700);
    }
  }

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging) return;

    state.lastBlink = getNow();

    eyeShells.forEach((eye) => {
      eye.style.height = "4px";
      eye.style.top = "12px";
    });

    window.setTimeout(() => {
      if (state.sleeping || state.dragging) return;
      eyeShells.forEach((eye) => {
        eye.style.height = "";
        eye.style.top = "";
      });
    }, 175);
  }

  function gazeAt(x, y) {
    if (!state.enabled || !character) return;

    const rect = character.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = Math.max(-1, Math.min(1, (x - centerX) / 190));
    const dy = Math.max(-1, Math.min(1, (y - centerY) / 145));

    state.gazeX += (dx * 6.0 - state.gazeX) * 0.22;
    state.gazeY += (dy * 5.0 - state.gazeY) * 0.22;

    character.style.setProperty("--gaze-x", state.gazeX + "px");
    character.style.setProperty("--gaze-y", state.gazeY + "px");
  }

  function nearestTargetFromPointer(x, y) {
    const rect = character.getBoundingClientRect();
    return Math.hypot(
      x - (rect.left + rect.width / 2),
      y - (rect.top + rect.height / 2)
    );
  }

  function handlePointerMove(event) {
    if (!state.enabled) return;

    state.lastActivity = getNow();
    gazeAt(event.clientX, event.clientY);

    if (state.sleeping) {
      react("wake", {}, true);
    }

    if (!state.dragging) {
      const distance = nearestTargetFromPointer(event.clientX, event.clientY);

      if (distance < 78 && getNow() - state.lastReaction > 1200) {
        setMood("curious", 650);
      }
    }
  }

  function handleCardHover(event) {
    if (!state.enabled) return;

    const card = event.target.closest?.(
      ".subject-card,.study-tools-card,.telegram-card,.utility-card,.tool-card,.student-counter,.live-card,.homepage-utility-card"
    );

    if (!card || card.contains(event.relatedTarget)) return;

    const context = elementContext(card);
    state.lastActivity = getNow();

    if (getNow() - state.lastReaction > 850) {
      react("hover-card", { context, element: card });
    }
  }

  function handleGlobalClick(event) {
    if (!state.enabled) return;

    const target = event.target.closest?.("a,button,[role='button']");
    if (!target) return;
    if (character.contains(target) || panel.contains(target) || target === launcher) return;

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

    const label = (
      target.id + " " +
      target.textContent + " " +
      target.getAttribute("aria-label")
    ).toLowerCase();

    if (/theme|dark mode|light mode/.test(label)) {
      react("theme");
    }
  }

  function handleTyping(event) {
    if (!state.enabled) return;

    const target = event.target;
    if (!(target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)) return;

    state.lastActivity = getNow();

    const value = (target.value || "").trim();

    if (target.id === "profileName" || target.name === "name") {
      react("typing", { name: value });

      window.clearTimeout(state.nameTimer);

      if (value.length >= 2) {
        state.nameTimer = window.setTimeout(() => {
          if (String(target.value || "").trim() === value) {
            react("name-complete", { name: value });
          }
        }, 900);
      }
    } else if (getNow() - state.lastReaction > 900) {
      react("typing");
    }
  }

  function handleFocus(event) {
    if (!state.enabled) return;

    const target = event.target;
    if (target.matches?.("input,textarea,select")) {
      react("typing");
    }
  }

  function handleScroll() {
    if (!state.enabled) return;

    state.lastActivity = getNow();
    if (getNow() - state.lastReaction > 1200) {
      react("scroll");
    }
  }

  function handleKeydown(event) {
    if (!state.enabled) return;

    state.lastActivity = getNow();

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === "Backspace" || event.key.length === 1) {
      if (getNow() - state.lastReaction > 1100) {
        react("typing");
      }
    }
  }

  function handlePetPointerDown(event) {
    if (!state.enabled) return;

    state.dragging = true;
    state.dragged = false;
    state.pointerId = event.pointerId;
    state.pointerStartX = event.clientX;
    state.pointerStartY = event.clientY;

    character.setPointerCapture?.(event.pointerId);
    character.classList.add("is-dragging");
    state.sleeping = false;

    react("scared", {}, true);
    event.preventDefault();
    event.stopPropagation();
  }

  function handlePetPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;

    const dx = event.clientX - state.pointerStartX;
    const dy = event.clientY - state.pointerStartY;

    if (Math.hypot(dx, dy) > 6) state.dragged = true;

    if (!state.dragged) return;

    const x = event.clientX;
    const y = event.clientY;

    state.lastActivity = getNow();
    setStagePosition(x, y, { drag: true });
    bubble.style.left = x + "px";
    bubble.style.top = Math.max(78, y - 34) + "px";
    gazeAt(x, y);
  }

  function finishPetPointer(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;

    const dragged = state.dragged;

    state.dragging = false;
    state.pointerId = null;
    character.classList.remove("is-dragging");
    character.classList.remove("is-walking", "is-climbing", "is-falling");

    try {
      character.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    if (dragged) {
      state.lastActivity = getNow();
      character.classList.add("is-landed");
      window.setTimeout(() => character.classList.remove("is-landed"), 500);
      showMessage("Put me there? 😳", 1500);
    } else {
      react("anger", {}, true);
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function togglePetPanelFromLauncher(event) {
    event.stopPropagation();
    setOpen(panel.hidden);
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

  launcher.addEventListener("click", (event) => {
    closeOtherPanels();
    togglePetPanelFromLauncher(event);
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
      state.lastActivity = getNow();
      react("wake", {}, true);
    }
  });

  window.addEventListener("resize", () => {
    setStagePosition(state.x, state.y, { drag: true });
  }, { passive: true });

  window.addEventListener("studylab-profile-updated", (event) => {
    const name = event.detail?.display_name || "";
    if (state.enabled && name) {
      react("name-complete", { name });
    }
  });

  const themeButton = document.querySelector("[data-theme-toggle]");
  themeButton?.addEventListener("click", () => react("theme"));

  const observer = new MutationObserver(() => {
    if (!state.enabled) return;

    const current = pageContext();
    if (current !== state.context) {
      state.context = current;
      setMood(current === "study" || current === "exam" ? "focused" : "curious", 1200);
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
      const idleMs = getNow() - state.lastActivity;
      const hour = new Date().getHours();
      const lateNight = hour >= 23 || hour < 6;
      const sleepThreshold = 7000;

      if (idleMs >= sleepThreshold && !state.sleeping) {
        state.sleeping = true;
        character.dataset.state = "sleeping";
        showMessage(lateNight ? "It's late... Zzz." : "Zzz...", 1500);
      }

      if (!state.sleeping && getNow() - state.lastBlink >= 10000) {
        blink();
      }

      if (!state.sleeping) {
        const ambientGap = state.context === "study" ? 2800 : 5200;
        if (getNow() - state.lastAmbient > ambientGap && Math.random() < (state.context === "study" ? 0.44 : 0.18)) {
          state.lastAmbient = getNow();

          const ambient = {
            home: ["Hmm... 👀", "Carry on.", "I'm watching."],
            physics: ["Watching the motion.", "Physics makes everything move."],
            chemistry: ["Waiting for a reaction... 🧪", "Lab mode."],
            maths: ["Numbers again. 📐", "Calculating quietly."],
            biology: ["Observing quietly. 🧬"],
            exam: ["Keep it calm.", "One paper at a time."],
            social: ["Student community detected."],
            study: ["Still studying? Good.", "Focus looks good.", "I'm keeping watch."]
          };

          const pool = ambient[state.context] || ambient.home;
          showMessage(pool[Math.floor(Math.random() * pool.length)], 1750);

          if (state.context === "study" && Math.random() < 0.55) {
            setMood("focused", 1800);
          }
        }
      }
    }

    window.setTimeout(activityLoop, 700);
  }

  state.enabled = Boolean(state.enabled);
  updateControls();
  setStagePosition(state.x, state.y, { drag: true });
  state.lastActivity = getNow();

  if (state.enabled) {
    window.setTimeout(() => react("wake", {}, true), 900);
    scheduleWander(2600);
  }

  activityLoop();

  window.setInterval(() => {
    if (state.anger > 0 && getNow() - state.lastReaction > 6500) {
      state.anger = Math.max(0, state.anger - 1);
    }
  }, 2200);
})();