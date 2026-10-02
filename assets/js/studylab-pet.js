/* =========================================================
   StudyLab Living Pet — final companion engine
   Inspired by expressive screen-pet interaction patterns.
   No simulation integration.
   ========================================================= */

(function () {
  "use strict";

  if (window.__StudyLabLivingPetFinal) return;
  window.__StudyLabLivingPetFinal = true;

  const KEY = {
    enabled: "studylab-pet-enabled",
    eye: "studylab-pet-eye",
    x: "studylab-pet-x",
    y: "studylab-pet-y"
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const now = () => Date.now();

  function readBool(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v === "true";
    } catch (_) {
      return fallback;
    }
  }

  function readText(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  const state = {
    enabled: readBool(KEY.enabled, true),
    eye: readText(KEY.eye, "cyan") === "pink" ? "pink" : "cyan",
    context: "home",
    expression: "neutral",
    previousExpression: "neutral",
    sleeping: false,
    dragging: false,
    dragged: false,
    danger: false,
    x: clamp(
      Number(readText(KEY.x, Math.round(window.innerWidth * .72))) || window.innerWidth * .72,
      56,
      window.innerWidth - 56
    ),
    y: clamp(
      Number(readText(KEY.y, Math.round(window.innerHeight * .54))) || window.innerHeight * .54,
      78,
      window.innerHeight - 86
    ),
    pointerX: window.innerWidth * .72,
    pointerY: window.innerHeight * .54,
    lastActivity: now(),
    lastMeaningfulActivity: now(),
    lastReaction: 0,
    lastMovement: now(),
    nextBlink: now() + random(7200, 10600),
    nextAmbient: now() + random(8500, 14000),
    nextWander: now() + random(13500, 21000),
    anger: 0,
    nameTimer: null,
    bubbleTimer: null,
    dragPointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    reactionTimer: null
  };

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "assets/css/studylab-pet.css";
  document.head.appendChild(link);

  document.body.insertAdjacentHTML("beforeend", `
    <div id="studylabPetStage">
      <div
        class="sl-pet-character"
        data-state="neutral"
        data-eye="cyan"
        data-danger="false"
        data-blink="false"
        role="button"
        tabindex="0"
        aria-label="StudyLab Pet"
      >
        <div class="sl-pet-face" aria-hidden="true">
          <div class="sl-pet-eye left"><i></i></div>
          <div class="sl-pet-eye right"><i></i></div>
          <div class="sl-pet-mouth"></div>
        </div>

        <svg class="sl-pet-crack" viewBox="0 0 32 26" aria-hidden="true">
          <path d="M26 2L20 8L22 11L16 14L18 18L11 24"></path>
          <path d="M20 8L26 9"></path>
        </svg>

        <div class="sl-pet-zzz" aria-hidden="true">
          <span>Z</span><span>z</span><span>z</span>
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
        <div class="sl-pet-setting-buttons">
          <button type="button" data-pet-enable>Enable</button>
          <button type="button" data-pet-disable>Disable</button>
        </div>
      </div>

      <div class="sl-pet-setting">
        <span>Eye colour</span>
        <div class="sl-pet-setting-buttons">
          <button type="button" data-pet-eye="cyan">Cyan</button>
          <button type="button" data-pet-eye="pink">Pink</button>
        </div>
      </div>

      <p class="sl-pet-panel-note">
        Expressive eyes, slow wandering, cursor awareness, sleep, and playful reactions.
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

  function getContext() {
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

    const combined = title + " " + text;
    if (/physics/.test(combined)) return "physics";
    if (/chemistry/.test(combined)) return "chemistry";
    if (/mathematics|combined maths|combined mathematics/.test(combined)) return "maths";
    if (/biology/.test(combined)) return "biology";
    if (/past papers|marking scheme|exam hub/.test(combined)) return "exam";
    return "home";
  }

  state.context = getContext();

  function setPosition(x, y, movement = "none", duration = 0) {
    const halfW = window.innerWidth <= 720 ? 41 : 45;
    const minY = 72;
    const maxY = Math.max(minY + 20, window.innerHeight - 84);

    state.x = clamp(x, halfW, window.innerWidth - halfW);
    state.y = clamp(y, minY, maxY);

    character.style.setProperty("--pet-left", state.x + "px");
    character.style.setProperty("--pet-top", state.y + "px");

    if (duration > 0) {
      character.style.setProperty("--pet-move-duration", duration + "ms");
      character.classList.remove("is-walking", "is-climbing", "is-falling", "is-landed");
      if (movement === "up") character.classList.add("is-climbing");
      else if (movement === "down") character.classList.add("is-falling");
      else character.classList.add("is-walking");
    }

    save(KEY.x, Math.round(state.x));
    save(KEY.y, Math.round(state.y));
  }

  function showBubble(message, duration = 1800) {
    if (!state.enabled || !message) return;
    bubble.textContent = message;
    bubble.classList.add("is-visible");
    window.clearTimeout(state.bubbleTimer);
    state.bubbleTimer = window.setTimeout(() => {
      bubble.classList.remove("is-visible");
    }, duration);
    bubble.style.left = state.x + "px";
    bubble.style.top = Math.max(78, state.y - 34) + "px";
  }

  function hideBubble() {
    bubble.classList.remove("is-visible");
  }

  /*
   * Expression engine:
   * 24 expression families x multiple procedural variants,
   * gaze positions, blink phases and two palettes produce
   * thousands of distinct rendered facial states without
   * shipping thousands of static images.
   */
  const expressions = [
    "neutral","curious","happy","excited","sad","worried",
    "angry","surprised","scared","suspicious","confused",
    "focused","bored","sleeping","thinking","dizzy",
    "relieved","shy","disappointed","love","delighted",
    "annoyed","calm","alert"
  ];

  function setExpression(expression, ttl = 1200, force = false) {
    if (!state.enabled && !force) return;

    const next = expressions.includes(expression) ? expression : "neutral";
    state.previousExpression = state.expression;
    state.expression = next;

    character.dataset.state = state.sleeping ? "sleeping" : next;
    character.dataset.micro = String(Math.floor(Math.random() * 12));

    if (ttl === 0) return;

    window.clearTimeout(state.reactionTimer);
    state.reactionTimer = window.setTimeout(() => {
      if (state.dragging) return;
      character.dataset.state = state.sleeping ? "sleeping" : "neutral";
      state.expression = state.sleeping ? "sleeping" : "neutral";
    }, ttl);
  }

  function contextMood(context) {
    if (context === "study" || context === "exam") return "focused";
    if (context === "chemistry") return "curious";
    if (context === "physics") return "alert";
    if (context === "maths") return "thinking";
    if (context === "biology") return "curious";
    if (context === "social") return "delighted";
    return "neutral";
  }

  function cardContext(element) {
    if (!element) return state.context;

    const value = [
      element.id || "",
      element.className || "",
      element.getAttribute("href") || "",
      element.getAttribute("aria-label") || "",
      element.textContent || ""
    ].join(" ").toLowerCase();

    if (/pomodoro|focus timer|flashcard|flash card|mistake|planner|converter|marks calculator|mock exam/.test(value)) return "study";
    if (/physics|doppler|gravity|projectile|wave|electricity/.test(value)) return "physics";
    if (/chemistry|රසායන|practical|organic|inorganic/.test(value)) return "chemistry";
    if (/maths|mathematics|සංයුක්ත ගණිතය|trigonometry|calculus|vector/.test(value)) return "maths";
    if (/biology|ජීව|genetics|cell structure/.test(value)) return "biology";
    if (/exam|past paper|marking scheme|model paper|school paper|timetable/.test(value)) return "exam";
    if (/telegram|community|channel/.test(value)) return "social";
    return state.context;
  }

  function utilityKind(element) {
    const value = [
      element?.id || "",
      element?.className || "",
      element?.textContent || ""
    ].join(" ").toLowerCase();

    if (/pomodoro|focus timer/.test(value)) return "pomodoro";
    if (/flashcard/.test(value)) return "flashcard";
    if (/mistake/.test(value)) return "mistake";
    if (/marks/.test(value)) return "marks";
    if (/planner/.test(value)) return "planner";
    if (/mock exam|exam timer/.test(value)) return "mock";
    if (/converter/.test(value)) return "converter";
    return "";
  }

  function react(type, detail = {}) {
    if (!state.enabled) return;

    const time = now();
    if (time - state.lastReaction < 300 && type !== "anger" && type !== "scared") return;

    state.lastReaction = time;
    state.lastActivity = time;
    state.lastMeaningfulActivity = time;
    state.sleeping = false;

    if (type === "hover-card") {
      const context = detail.context || state.context;
      const utility = utilityKind(detail.element);

      if (context === "study" && utility === "pomodoro") {
        setExpression("focused", 1800);
      } else if (context === "study" && utility === "flashcard") {
        setExpression("curious", 1300);
      } else if (context === "study" && utility === "mistake") {
        setExpression("worried", 1300);
      } else if (context === "study" && utility === "marks") {
        setExpression("thinking", 1300);
      } else if (context === "study" && utility === "planner") {
        setExpression("focused", 1300);
      } else if (context === "study" && utility === "mock") {
        setExpression("alert", 1400);
      } else if (context === "study" && utility === "converter") {
        setExpression("curious", 1100);
      } else {
        setExpression(contextMood(context), 1200);
      }

      if (Math.random() < 0.18) {
        const messages = {
          physics: ["⚛️", "Watching."],
          chemistry: ["🧪", "Curious."],
          maths: ["📐", "Thinking..."],
          biology: ["🧬", "Observing."],
          study: ["Focus.", "Still here."],
          exam: ["Lock in."],
          social: ["👀"]
        };
        const pool = messages[context] || ["👀"];
        showBubble(pool[Math.floor(Math.random() * pool.length)], 1500);
      }
      return;
    }

    if (type === "click-card") {
      const context = detail.context || state.context;
      const utility = utilityKind(detail.element);

      if (context === "study" && utility === "pomodoro") {
        setExpression("focused", 2300);
        showBubble("⏱️", 1200);
      } else if (context === "study" && utility === "flashcard") {
        setExpression("excited", 1200);
      } else if (context === "study" && utility === "mistake") {
        setExpression("worried", 1500);
      } else if (context === "study" && utility === "marks") {
        setExpression("thinking", 1400);
      } else if (context === "exam") {
        setExpression("alert", 1500);
      } else if (context === "chemistry") {
        setExpression("delighted", 1350);
      } else if (context === "physics") {
        setExpression("excited", 1300);
      } else if (context === "maths") {
        setExpression("thinking", 1250);
      } else {
        setExpression("happy", 1050);
      }
      return;
    }

    if (type === "typing") {
      setExpression(detail.isName ? "curious" : "alert", 900);
      if (detail.isName && Math.random() < .35) showBubble("👀", 1000);
      return;
    }

    if (type === "name-complete") {
      setExpression("delighted", 1450);
      if (detail.name) showBubble("👀", 1200);
      return;
    }

    if (type === "search") {
      setExpression("curious", 1100);
      return;
    }

    if (type === "theme") {
      setExpression("surprised", 900);
      return;
    }

    if (type === "scroll") {
      setExpression("alert", 500);
      return;
    }

    if (type === "scared") {
      setExpression("scared", 1250, true);
      return;
    }

    if (type === "anger") {
      state.anger += 1;
      state.danger = true;
      character.dataset.danger = "true";
      setExpression("angry", 1300, true);

      window.setTimeout(() => {
        state.danger = false;
        character.dataset.danger = "false";
      }, 1350);

      if (state.anger >= 3 && Math.random() < .55) {
        showBubble("...", 1150);
      }
      return;
    }

    if (type === "wake") {
      setExpression("curious", 1000);
      return;
    }
  }

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging) return;

    character.dataset.blink = "true";
    state.lastActivity = now();

    const double = Math.random() < .08;
    window.setTimeout(() => {
      character.dataset.blink = "false";
      if (double && state.enabled && !state.sleeping) {
        window.setTimeout(() => {
          character.dataset.blink = "true";
          window.setTimeout(() => {
            character.dataset.blink = "false";
          }, 115);
        }, 105);
      }
    }, 135);

    state.nextBlink = now() + random(7200, 10600);
  }

  function gazeAt(x, y) {
    if (!state.enabled) return;

    const rect = character.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const gx = clamp((x - centerX) / 150, -1, 1) * 6.2;
    const gy = clamp((y - centerY) / 125, -1, 1) * 5.3;

    state.pointerX = x;
    state.pointerY = y;

    eyes.forEach((eye) => {
      eye.style.transform =
        "translate(" +
        "calc(-50% + " + gx.toFixed(2) + "px), " +
        "calc(-50% + " + gy.toFixed(2) + "px))";
    });
  }

  function movePetNaturally() {
    if (!state.enabled || state.sleeping || state.dragging || reduced) return;

    const oldX = state.x;
    const oldY = state.y;

    const targetX = random(65, Math.max(70, window.innerWidth - 65));
    const targetY = random(88, Math.max(95, window.innerHeight - 100));

    const dx = targetX - oldX;
    const dy = targetY - oldY;
    const distance = Math.hypot(dx, dy);

    if (distance < 95) {
      state.nextWander = now() + random(6500, 10500);
      return;
    }

    const movement = Math.abs(dy) > Math.abs(dx) * .55
      ? (dy < 0 ? "up" : "down")
      : "horizontal";

    const duration = movement === "up"
      ? clamp(1500 + distance * 2.9, 1800, 3300)
      : movement === "down"
        ? clamp(850 + distance * 1.35, 1000, 2100)
        : clamp(1200 + distance * 1.8, 1500, 2800);

    state.lastMovement = now();

    setExpression(
      movement === "up" ? "focused" :
      movement === "down" ? "alert" :
      (Math.random() < .45 ? "curious" : "neutral"),
      950
    );

    setPosition(targetX, targetY, movement, duration);

    window.setTimeout(() => {
      character.classList.remove("is-walking", "is-climbing", "is-falling");
      if (movement === "down") {
        character.classList.add("is-landed");
        window.setTimeout(() => character.classList.remove("is-landed"), 520);
      }
    }, duration + 40);

    state.nextWander =
      now() +
      (state.context === "study"
        ? random(10500, 17500)
        : random(15000, 25000));
  }

  function idleLoop() {
    if (!state.enabled || document.hidden || state.dragging) return;

    const idleFor = now() - state.lastActivity;

    if (idleFor >= 7800 && !state.sleeping) {
      state.sleeping = true;
      state.expression = "sleeping";
      character.dataset.state = "sleeping";
      character.dataset.blink = "false";
      hideBubble();
      return;
    }

    if (state.sleeping) return;

    if (now() >= state.nextBlink) blink();

    if (now() >= state.nextWander) movePetNaturally();

    if (now() >= state.nextAmbient) {
      state.nextAmbient =
        now() +
        (state.context === "study" ? random(9500, 15000) : random(16000, 26000));

      const contextChance = state.context === "study" ? .45 : .17;

      if (Math.random() < contextChance) {
        const ambientStates = {
          home: ["calm","neutral","curious"],
          physics: ["alert","curious","thinking"],
          chemistry: ["curious","delighted","alert"],
          maths: ["thinking","focused","curious"],
          biology: ["curious","calm","alert"],
          study: ["focused","thinking","alert","delighted"],
          exam: ["focused","alert","worried"],
          social: ["delighted","curious","happy"]
        };

        const pool = ambientStates[state.context] || ambientStates.home;
        setExpression(pool[Math.floor(Math.random() * pool.length)], 1800);

        if (state.context === "study" && Math.random() < .14) {
          showBubble("👀", 1050);
        }
      }
    }

    window.setTimeout(idleLoop, 550);
  }

  function wakeFromActivity() {
    state.lastActivity = now();
    state.lastMeaningfulActivity = now();

    if (state.sleeping) {
      state.sleeping = false;
      react("wake");
      state.nextWander = now() + random(9000, 14500);
    }
  }

  function pointerMove(event) {
    if (!state.enabled) return;
    state.lastActivity = now();
    gazeAt(event.clientX, event.clientY);

    if (state.sleeping) {
      wakeFromActivity();
      return;
    }

    const rect = character.getBoundingClientRect();
    const dist = Math.hypot(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2)
    );

    if (!state.dragging && dist < 82 && now() - state.lastReaction > 1450) {
      setExpression("curious", 700);
    }
  }

  function pointerOver(event) {
    if (!state.enabled) return;

    const target = event.target;
    const card = target.closest?.(
      ".subject-card,.study-tools-card,.telegram-card,.utility-card,.tool-card,.live-card,.student-counter"
    );

    if (!card || card.contains(event.relatedTarget)) return;

    const context = cardContext(card);
    state.lastActivity = now();

    if (now() - state.lastReaction > 800) {
      react("hover-card", { context, element: card });
    }
  }

  function globalClick(event) {
    if (!state.enabled) return;

    const target = event.target.closest?.("a,button,[role='button']");
    if (!target) return;

    if (
      target === launcher ||
      panel.contains(target) ||
      character.contains(target)
    ) {
      return;
    }

    const context = cardContext(target);
    const isCard = target.matches(
      ".subject-card,.study-tools-card,.telegram-card,.utility-card,.tool-card,.live-card"
    );

    const utility = utilityKind(target);

    if (isCard || utility) {
      react("click-card", { context, element: target });
    }

    const label = [
      target.id || "",
      target.textContent || "",
      target.getAttribute("aria-label") || "",
      target.title || ""
    ].join(" ").toLowerCase();

    if (/theme|dark mode|light mode/.test(label)) {
      react("theme");
    }
  }

  function inputEvent(event) {
    if (!state.enabled) return;

    const target = event.target;
    const isField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    if (!isField) return;

    state.lastActivity = now();

    const value = (target.value || "").trim();
    const isName = target.id === "profileName" || target.name === "name";
    const isSearch =
      target.type === "search" ||
      target.getAttribute("role") === "searchbox" ||
      /search/i.test(target.placeholder || "");

    if (isName) {
      react("typing", { isName: true, name: value });
      window.clearTimeout(state.nameTimer);

      if (value.length >= 2) {
        state.nameTimer = window.setTimeout(() => {
          if (String(target.value || "").trim() === value) {
            react("name-complete", { name: value });
          }
        }, 950);
      }
    } else if (isSearch) {
      react("search");
    } else if (now() - state.lastReaction > 950) {
      react("typing");
    }
  }

  function keydown(event) {
    if (!state.enabled) return;

    state.lastActivity = now();

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key.length === 1 || event.key === "Backspace" || event.key === "Enter") {
      const focused = document.activeElement;
      const isName =
        focused?.id === "profileName" ||
        focused?.name === "name";
      react("typing", { isName });
    }
  }

  function focusIn(event) {
    if (!state.enabled) return;

    if (event.target.matches?.("input,textarea,select")) {
      const isName =
        event.target.id === "profileName" ||
        event.target.name === "name";

      react("typing", { isName });
    }
  }

  function handleScroll() {
    if (!state.enabled) return;
    state.lastActivity = now();

    if (!state.dragging && now() - state.lastReaction > 1200) {
      react("scroll");
    }
  }

  function petPointerDown(event) {
    if (!state.enabled) return;

    state.dragging = true;
    state.dragged = false;
    state.dragPointerId = event.pointerId;
    state.lastActivity = now();

    const rect = character.getBoundingClientRect();
    state.dragOffsetX = event.clientX - (rect.left + rect.width / 2);
    state.dragOffsetY = event.clientY - (rect.top + rect.height / 2);

    character.setPointerCapture?.(event.pointerId);
    character.classList.remove("is-walking", "is-climbing", "is-falling", "is-landed");
    character.classList.add("is-dragging");

    react("scared", {}, true);
    event.preventDefault();
    event.stopPropagation();
  }

  function petPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.dragPointerId) return;

    const dx = event.clientX - (state.x + state.dragOffsetX);
    const dy = event.clientY - (state.y + state.dragOffsetY);

    if (Math.hypot(
      event.clientX - state.pointerX,
      event.clientY - state.pointerY
    ) > 5) {
      state.dragged = true;
    }

    state.pointerX = event.clientX;
    state.pointerY = event.clientY;

    const x = event.clientX - state.dragOffsetX;
    const y = event.clientY - state.dragOffsetY;

    character.style.transition = "none";
    setPosition(x, y, "horizontal", 0);
    gazeAt(event.clientX, event.clientY);

    event.preventDefault();
    event.stopPropagation();
  }

  function petPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.dragPointerId) return;

    const dragged = state.dragged;

    state.dragging = false;
    state.dragPointerId = null;
    character.classList.remove("is-dragging");

    character.style.transition = "";

    try {
      character.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    state.lastActivity = now();

    if (dragged) {
      character.classList.add("is-landed");
      window.setTimeout(() => character.classList.remove("is-landed"), 500);
      setExpression("relieved", 900);
    } else {
      react("anger", {}, true);
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
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

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    state.sleeping = false;
    save(KEY.enabled, state.enabled);

    if (!state.enabled) {
      hideBubble();
      setOpen(false);
      character.dataset.state = "neutral";
      character.dataset.blink = "false";
      character.dataset.danger = "false";
      character.classList.remove("is-dragging","is-walking","is-climbing","is-falling","is-landed");
      stage.classList.add("is-disabled");
    } else {
      stage.classList.remove("is-disabled");
      state.lastActivity = now();
      state.nextBlink = now() + random(7000, 10000);
      state.nextWander = now() + random(10000, 16000);
      setExpression("curious", 1000);
    }

    updateControls();
  }

  function setEyeColor(eye) {
    state.eye = eye === "pink" ? "pink" : "cyan";
    character.dataset.eye = state.eye;
    save(KEY.eye, state.eye);
    updateControls();

    if (state.enabled) {
      setExpression("delighted", 900);
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
    event.stopPropagation();
    closeOtherPanels();
    setOpen(panel.hidden);
  });

  closeButton.addEventListener("click", () => setOpen(false));

  enableButton.addEventListener("click", () => setEnabled(true));
  disableButton.addEventListener("click", () => setEnabled(false));

  eyeButtons.forEach((button) => {
    button.addEventListener("click", () => setEyeColor(button.dataset.petEye));
  });

  character.addEventListener("pointerdown", petPointerDown);
  character.addEventListener("pointermove", petPointerMove);
  character.addEventListener("pointerup", petPointerUp);
  character.addEventListener("pointercancel", petPointerUp);

  character.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      react("anger", {}, true);
    }
  });

  document.addEventListener("mousemove", pointerMove, { passive: true });
  document.addEventListener("pointerover", pointerOver, { passive: true });
  document.addEventListener("click", globalClick, true);
  document.addEventListener("input", inputEvent, { passive: true });
  document.addEventListener("keydown", keydown);
  document.addEventListener("focusin", focusIn);
  document.addEventListener("scroll", handleScroll, { passive: true });

  document.addEventListener("click", (event) => {
    if (
      !panel.hidden &&
      !panel.contains(event.target) &&
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
      hideBubble();
    } else {
      state.sleeping = false;
      state.lastActivity = now();
      setExpression("curious", 900);
    }
  });

  window.addEventListener("resize", () => {
    setPosition(state.x, state.y, "horizontal", 0);
    gazeAt(state.pointerX, state.pointerY);
  }, { passive: true });

  window.addEventListener("studylab-profile-updated", (event) => {
    const name = event.detail?.display_name || "";
    if (state.enabled && name) {
      react("name-complete", { name });
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    const themeButton = document.querySelector("[data-theme-toggle]");
    themeButton?.addEventListener("click", () => react("theme"));
  });

  setPosition(state.x, state.y, "horizontal", 0);
  updateControls();
  gazeAt(state.pointerX, state.pointerY);

  if (state.enabled) {
    window.setTimeout(() => react("wake"), 800);
  } else {
    stage.classList.add("is-disabled");
  }

  window.setInterval(() => {
    if (state.anger > 0 && now() - state.lastReaction > 6500) {
      state.anger = Math.max(0, state.anger - 1);
    }
  }, 2200);

  idleLoop();
})();