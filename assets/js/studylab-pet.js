/* =========================================================
   StudyLab Living Pet
   EMO-style expressive display companion.
   Global page-level only. No simulation internals.
   ========================================================= */
(function () {
  "use strict";

  if (window.__StudyLabLivingPetLoaded) return;
  window.__StudyLabLivingPetLoaded = true;

  const STORAGE = {
    enabled: "studylab-pet-enabled",
    eye: "studylab-pet-eye",
    messages: "studylab-pet-messages"
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function now() {
    return Date.now();
  }

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
    messages: readBool(STORAGE.messages, true),
    eye: readEye(),

    context: "home",
    expression: "idle",
    sleeping: false,

    x: Math.min(window.innerWidth - 100, Math.max(100, window.innerWidth * 0.72)),
    y: Math.min(window.innerHeight - 120, Math.max(120, window.innerHeight * 0.57)),

    gazeTargetX: 0,
    gazeTargetY: 0,
    gazeX: 0,
    gazeY: 0,

    dragging: false,
    dragged: false,
    pointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,

    lastInteraction: now(),
    lastReaction: 0,
    lastBlink: now(),
    nextBlinkAt: now() + 8200 + Math.random() * 2600,
    lastMove: now(),
    lastHover: 0,
    lastMicro: 0,

    anger: 0,
    avoidUntil: 0,
    lastFlee: 0,

    wanderTimer: 0,
    messageTimer: 0,
    settleTimer: 0,
    nameTimer: 0,

    expressionVariant: 0
  };

  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = "assets/css/studylab-pet.css";
  document.head.appendChild(styleLink);

  document.body.insertAdjacentHTML("beforeend", `
    <div id="studylabPetStage" aria-hidden="false">
      <div
        class="sl-pet-character"
        data-expression="idle"
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
          <span class="sl-pet-crack"></span>
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
      <span class="sl-pet-launcher-icon" aria-hidden="true">🐾</span>
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
        <span>Messages</span>
        <div class="sl-pet-setting-buttons" role="group" aria-label="Pet message state">
          <button type="button" data-pet-messages-enable>Enable</button>
          <button type="button" data-pet-messages-disable>Disable</button>
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
        EMO-style expressive eyes, gentle wandering, cursor attention, sleep, drag-and-place,
        contextual reactions and a few messages when useful.
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
  const messagesEnableButton = panel.querySelector("[data-pet-messages-enable]");
  const messagesDisableButton = panel.querySelector("[data-pet-messages-disable]");
  const eyeButtons = [...panel.querySelectorAll("[data-pet-eye]")];

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE.enabled, String(state.enabled));
      localStorage.setItem(STORAGE.eye, state.eye);
      localStorage.setItem(STORAGE.messages, String(state.messages));
    } catch (_) {}
  }

  function getPageContext() {
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
    if (path.includes("audio_books")) return "audio";

    const combined = title + " " + text;

    if (/physics/.test(combined)) return "physics";
    if (/chemistry/.test(combined)) return "chemistry";
    if (/mathematics|combined maths|combined mathematics/.test(combined)) return "maths";
    if (/biology/.test(combined)) return "biology";
    if (/past papers|marking schemes|exam hub/.test(combined)) return "exam";
    return "home";
  }

  state.context = getPageContext();

  const contextMessages = {
    home: ["Hmm.", "I noticed that.", "👀"],
    physics: ["Physics.", "Watching.", "Interesting."],
    chemistry: ["🧪", "Lab mode.", "Watching."],
    maths: ["Maths.", "Numbers.", "Calculating."],
    biology: ["🧬", "Observing.", "Interesting."],
    exam: ["Exam mode.", "Serious.", "Paper hunt."],
    social: ["👀", "Community.", "I see."],
    audio: ["Listening.", "Audio time.", "I hear that."]
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
    if (/countdown|count down/.test(value)) return "countdown";
    if (/search/.test(value)) return "search";
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

    if (/study tools|study utilities|pomodoro|flashcard|mistake|planner|converter|marks calculator|mock exam|countdown/.test(value)) return "study";
    if (/physics|doppler|gravity|gravitational|projectile|wave|electricity/.test(value)) return "physics";
    if (/chemistry|රසායන|practical|organic|inorganic/.test(value)) return "chemistry";
    if (/maths|mathematics|සංයුක්ත ගණිතය|trigonometry|calculus|vector/.test(value)) return "maths";
    if (/biology|ජීව|genetics|cell structure/.test(value)) return "biology";
    if (/exam|past paper|marking scheme|model paper|school paper|timetable/.test(value)) return "exam";
    if (/telegram|community|channel/.test(value)) return "social";
    return state.context;
  }

  function clampPosition(x, y) {
    const halfW = 48;
    const halfH = 36;
    return {
      x: Math.max(halfW + 8, Math.min(window.innerWidth - halfW - 8, x)),
      y: Math.max(halfH + 8, Math.min(window.innerHeight - halfH - 20, y))
    };
  }

  function setPosition(x, y, options = {}) {
    const next = clampPosition(x, y);

    if (!options.drag) {
      const dx = next.x - state.x;
      const dy = next.y - state.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 26) {
        state.lastMove = now();

        let duration;
        let ease;

        if (dy < -22) {
          duration = 6000 + Math.min(2600, Math.abs(dy) * 5);
          ease = "cubic-bezier(.25,.58,.18,1)";
          character.style.setProperty("--eye-width", "14px");
          character.style.setProperty("--eye-height", "19px");
          character.classList.remove("is-moving", "is-falling", "is-landed");
          character.classList.add("is-climbing");
        } else if (dy > 22) {
          duration = 2800 + Math.min(1200, Math.abs(dy) * 2);
          ease = "cubic-bezier(.15,.88,.25,1.12)";
          character.classList.remove("is-moving", "is-climbing", "is-landed");
          character.classList.add("is-falling");
        } else {
          duration = 5000 + Math.random() * 1800;
          ease = "cubic-bezier(.20,.72,.20,1)";
          character.classList.remove("is-climbing", "is-falling", "is-landed");
          character.classList.add("is-moving");
          character.style.setProperty("--eye-width", "15px");
          character.style.setProperty("--eye-height", "21px");
        }

        character.style.setProperty("--pet-move-duration", Math.round(duration) + "ms");
        character.style.setProperty("--pet-move-ease", ease);

        window.clearTimeout(state.settleTimer);

        if (dy > 22) {
          state.settleTimer = window.setTimeout(() => {
            if (!state.dragging && state.enabled) {
              character.classList.remove("is-falling");
              character.classList.add("is-landed");
              window.setTimeout(() => character.classList.remove("is-landed"), 520);
            }
          }, duration + 40);
        }

        window.setTimeout(() => {
          if (!state.dragging && state.enabled) {
            character.classList.remove("is-moving", "is-climbing");
            character.style.removeProperty("--eye-width");
            character.style.removeProperty("--eye-height");
          }
        }, duration + 80);
      }
    }

    state.x = next.x;
    state.y = next.y;

    character.style.left = next.x + "px";
    character.style.top = next.y + "px";

    bubble.style.left = next.x + "px";
    bubble.style.top = Math.max(80, next.y - 38) + "px";
  }

  function chooseWanderTarget() {
    const study = state.context === "study";
    const longMove = Math.random() < (study ? 0.20 : 0.13);

    if (longMove) {
      return clampPosition(
        70 + Math.random() * Math.max(1, window.innerWidth - 140),
        90 + Math.random() * Math.max(1, window.innerHeight - 185)
      );
    }

    const distance = 60 + Math.random() * (study ? 75 : 55);
    const angle = Math.random() * Math.PI * 2;

    return clampPosition(
      state.x + Math.cos(angle) * distance,
      state.y + Math.sin(angle) * distance * .68
    );
  }

  function scheduleWander(delay) {
    window.clearTimeout(state.wanderTimer);

    state.wanderTimer = window.setTimeout(() => {
      if (!state.enabled || state.sleeping || state.dragging || document.hidden) {
        scheduleWander(state.sleeping ? 5000 : 7000);
        return;
      }

      const cooldown = now() - state.lastMove;

      if (cooldown < 6500) {
        scheduleWander(8500);
        return;
      }

      if (Math.random() < (state.context === "study" ? 0.72 : 0.58)) {
        const target = chooseWanderTarget();
        setPosition(target.x, target.y);
      }

      scheduleWander(
        state.context === "study"
          ? 10500 + Math.random() * 6000
          : 14500 + Math.random() * 9000
      );
    }, delay);
  }

  function showMessage(message, duration = 1450, force = false) {
    if ((!state.enabled || !state.messages) && !force) return;

    bubble.textContent = message;
    bubble.classList.add("is-visible");

    window.clearTimeout(state.messageTimer);
    state.messageTimer = window.setTimeout(() => {
      bubble.classList.remove("is-visible");
    }, duration);
  }

  function maybeMessage(pool, chance = .18) {
    if (!state.messages || Math.random() > chance) return;
    if (bubble.classList.contains("is-visible")) return;

    showMessage(pool[Math.floor(Math.random() * pool.length)], 1350);
  }

  function setExpression(expression, duration = 0) {
    if (!state.enabled) return;

    state.expression = expression;
    state.expressionVariant++;

    /*
     * Procedural variations are intentionally small. Combining eye width,
     * height, tilt, asymmetry, gaze and mouth geometry produces thousands
     * of visually distinct states without maintaining thousands of assets.
     */
    const jitter = () => (Math.random() * 2 - 1);

    character.dataset.expression = expression;

    character.style.setProperty("--eye-x", (jitter() * 1.4).toFixed(2) + "px");
    character.style.setProperty("--eye-y", (jitter() * 1.1).toFixed(2) + "px");
    character.style.setProperty("--eye-rotate", (jitter() * (expression === "angry" ? 3.5 : 2.2)).toFixed(2) + "deg");
    character.style.setProperty("--eye-scale-x", (1 + jitter() * .045).toFixed(3));
    character.style.setProperty("--eye-scale-y", (1 + jitter() * .045).toFixed(3));

    if (expression === "curious") {
      character.style.setProperty("--eye-y", (-1 + jitter() * 1.2).toFixed(2) + "px");
    }

    if (duration > 0) {
      window.clearTimeout(state.settleTimer);
      state.settleTimer = window.setTimeout(() => {
        if (!state.sleeping && !state.dragging && state.enabled) {
          setExpression("idle");
        }
      }, duration);
    }
  }

  function updateControls() {
    stage.classList.toggle("is-disabled", !state.enabled);

    character.dataset.eye = state.eye;

    enableButton.classList.toggle("is-active", state.enabled);
    disableButton.classList.toggle("is-active", !state.enabled);

    messagesEnableButton.classList.toggle("is-active", state.messages);
    messagesDisableButton.classList.toggle("is-active", !state.messages);

    eyeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    state.sleeping = false;
    state.avoidUntil = 0;

    if (!state.enabled) {
      bubble.classList.remove("is-visible");
      character.dataset.expression = "idle";
      character.classList.remove("is-moving", "is-climbing", "is-falling", "is-landed", "is-dragging", "is-blinking");
      window.clearTimeout(state.wanderTimer);
    } else {
      state.lastInteraction = now();
      state.context = getPageContext();
      setExpression("sleepy", 700);
      showMessage("I'm back. 👀", 1350);
      scheduleWander(4800);
    }

    updateControls();
    savePreferences();
  }

  function setMessages(enabled) {
    state.messages = Boolean(enabled);
    if (!state.messages) bubble.classList.remove("is-visible");
    updateControls();
    savePreferences();

    if (state.enabled && state.messages) {
      showMessage("Message mode on.", 1000);
    }
  }

  function setEye(eye) {
    state.eye = eye === "pink" ? "pink" : "cyan";
    updateControls();
    savePreferences();

    if (!state.enabled) return;

    /*
     * Cyan and Pink have different behavioral profiles while retaining
     * the same physical character.
     */
    setExpression(state.eye === "pink" ? "playful" : "excited", 900);
    showMessage(state.eye === "pink" ? "🩷" : "🩵", 950);
  }

  function react(type, detail = {}, force = false) {
    if (!state.enabled && !force) return;

    const timestamp = now();

    if (!force && timestamp - state.lastReaction < 500) return;

    state.lastReaction = timestamp;
    state.lastInteraction = timestamp;
    state.sleeping = false;

    if (type === "wake") {
      setExpression("sleepy", 500);
      window.setTimeout(() => {
        if (state.enabled && !state.sleeping) {
          setExpression(state.eye === "pink" ? "playful" : "curious", 750);
        }
      }, 360);
      return;
    }

    if (type === "hover-card") {
      const context = detail.context || state.context;
      const utility = detail.element ? utilityKind(detail.element) : "";

      if (context === "study") {
        if (utility === "pomodoro" || utility === "mock") setExpression("focused", 1000);
        else if (utility === "marks") setExpression("surprised", 950);
        else if (utility === "mistake") setExpression("confused", 950);
        else if (utility === "flashcard") setExpression("curious", 850);
        else setExpression(state.eye === "pink" ? "playful" : "curious", 850);
      } else if (context === "chemistry") {
        setExpression("excited", 1000);
      } else if (context === "physics") {
        setExpression("curious", 900);
      } else if (context === "maths") {
        setExpression("thinking", 900);
      } else if (context === "biology") {
        setExpression("curious", 850);
      } else if (context === "exam") {
        setExpression("focused", 1000);
      } else {
        setExpression(state.eye === "pink" ? "playful" : "curious", 850);
      }

      const pool = contextMessages[context];
      if (pool) maybeMessage(pool, .11);
      return;
    }

    if (type === "click-card") {
      const context = detail.context || state.context;
      const utility = detail.element ? utilityKind(detail.element) : "";

      if (context === "study") {
        if (utility === "pomodoro" || utility === "mock") {
          setExpression("focused", 1600);
          maybeMessage(["Focus.", "Lock in.", "Study mode."], .38);
        } else if (utility === "marks") {
          setExpression("surprised", 1000);
        } else if (utility === "mistake") {
          setExpression("confused", 1100);
        } else if (utility === "flashcard") {
          setExpression("curious", 1000);
        } else {
          setExpression(state.eye === "pink" ? "playful" : "focused", 950);
        }
      } else if (context === "chemistry") {
        setExpression("excited", 1100);
      } else if (context === "physics") {
        setExpression("curious", 1000);
      } else if (context === "maths") {
        setExpression("thinking", 1100);
      } else if (context === "biology") {
        setExpression("happy", 1000);
      } else if (context === "exam") {
        setExpression("focused", 1300);
      } else {
        setExpression(state.eye === "pink" ? "playful" : "happy", 900);
      }

      return;
    }

    if (type === "typing") {
      setExpression("curious", 750);
      if (detail.name && state.messages && Math.random() < .16) {
        showMessage("👀", 1050);
      }
      return;
    }

    if (type === "name-complete") {
      setExpression(state.eye === "pink" ? "happy" : "excited", 1250);
      maybeMessage(["Hi. 👋", "Nice to meet you.", "I noticed your name."], .42);
      return;
    }

    if (type === "theme") {
      setExpression("surprised", 700);
      return;
    }

    if (type === "scroll") {
      setExpression(state.eye === "pink" ? "playful" : "curious", 520);
      return;
    }

    if (type === "anger") {
      const recent = timestamp - state.lastReaction < 4600;
      state.anger = Math.min(4, state.anger + (recent ? 1 : .5));
      state.avoidUntil = timestamp + 4300 + state.anger * 450;

      setExpression("angry", 1450);

      if (state.messages) {
        if (state.anger >= 3) showMessage("...", 1050);
        else if (state.anger >= 2) showMessage("Stop.", 1000);
        else showMessage("Hey.", 950);
      }

      fleeFromCursor(true);

      window.setTimeout(() => {
        if (state.enabled && !state.dragging && !state.sleeping) {
          setExpression("annoyed", 650);
        }
      }, 1450);

      return;
    }

    if (type === "scared") {
      setExpression("scared", 900);
      if (state.messages) maybeMessage(["😳", "Careful.", "Easy..."], .35);
      return;
    }
  }

  function fleeFromCursor(force = false) {
    if (!state.enabled || state.dragging || state.sleeping) return;

    const x = state.cursorX;
    const y = state.cursorY;
    const distance = Math.hypot(x - state.x, y - state.y);

    if (!force && now() > state.avoidUntil) return;
    if (!force && distance > 155) return;
    if (!force && now() - state.lastFlee < 1200) return;

    state.lastFlee = now();

    let angle = Math.atan2(state.y - y, state.x - x);

    if (!Number.isFinite(angle)) angle = Math.random() * Math.PI * 2;

    const distanceOut = 150 + Math.random() * 90;
    const target = clampPosition(
      state.x + Math.cos(angle) * distanceOut,
      state.y + Math.sin(angle) * distanceOut * .72
    );

    character.classList.remove("is-moving", "is-climbing", "is-falling", "is-landed");
    character.style.setProperty("--pet-move-duration", "1750ms");
    character.style.setProperty("--pet-move-ease", "cubic-bezier(.12,.86,.22,1)");
    character.classList.add("is-moving");
    character.style.setProperty("--eye-width", "15px");
    character.style.setProperty("--eye-height", "21px");

    setPosition(target.x, target.y);

    window.setTimeout(() => {
      character.classList.remove("is-moving");
      character.style.removeProperty("--eye-width");
      character.style.removeProperty("--eye-height");
    }, 1900);
  }

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging) return;

    state.lastBlink = now();
    state.nextBlinkAt = now() + 8500 + Math.random() * 3000;
    character.classList.add("is-blinking");

    window.setTimeout(() => {
      if (state.enabled && !state.sleeping && !state.dragging) {
        character.classList.remove("is-blinking");
      }
    }, 190);
  }

  function gazeAt(x, y) {
    const dx = Math.max(-1, Math.min(1, (x - state.x) / 210));
    const dy = Math.max(-1, Math.min(1, (y - state.y) / 160));

    state.gazeTargetX = dx * 6.0;
    state.gazeTargetY = dy * 5.1;
  }

  function gazeLoop() {
    if (state.enabled) {
      state.gazeX += (state.gazeTargetX - state.gazeX) * 0.08;
      state.gazeY += (state.gazeTargetY - state.gazeY) * 0.08;

      eyes.forEach((eye) => {
        eye.style.setProperty("--gaze-x", state.gazeX.toFixed(2) + "px");
        eye.style.setProperty("--gaze-y", state.gazeY.toFixed(2) + "px");
      });
    }

    requestAnimationFrame(gazeLoop);
  }

  function handlePointerMove(event) {
    if (!state.enabled) return;

    state.cursorX = event.clientX;
    state.cursorY = event.clientY;
    gazeAt(event.clientX, event.clientY);

    if (state.sleeping) {
      state.sleeping = false;
      react("wake", {}, true);
    }

    if (state.avoidUntil > now()) {
      fleeFromCursor();
    } else {
      const distance = Math.hypot(event.clientX - state.x, event.clientY - state.y);
      if (distance < 82 && now() - state.lastReaction > 1500) {
        setExpression(state.eye === "pink" ? "playful" : "curious", 700);
      }
    }
  }

  function handleCardHover(event) {
    if (!state.enabled) return;

    const card = event.target.closest?.(
      ".subject-card,.study-tools-card,.telegram-card,.utility-card,.tool-card,.student-counter,.live-card,.homepage-utility-card"
    );

    if (!card || card.contains(event.relatedTarget)) return;

    const t = now();

    if (t - state.lastHover < 1400) return;

    state.lastHover = t;
    state.lastInteraction = t;

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
      (target.getAttribute("aria-label") || "")
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

    state.lastInteraction = now();

    const value = String(target.value || "").trim();

    if (target.id === "profileName" || target.name === "name") {
      react("typing", { name: value });

      window.clearTimeout(state.nameTimer);

      if (value.length >= 2) {
        state.nameTimer = window.setTimeout(() => {
          if (String(target.value || "").trim() === value) {
            react("name-complete", { name: value });
          }
        }, 950);
      }
    } else if (now() - state.lastReaction > 1000) {
      react("typing");
    }
  }

  function handleFocus(event) {
    if (!state.enabled) return;
    if (event.target.matches?.("input,textarea,select")) {
      state.lastInteraction = now();
      react("typing");
    }
  }

  function handleScroll() {
    if (!state.enabled) return;

    state.lastInteraction = now();

    if (now() - state.lastReaction > 1200) {
      react("scroll");
    }
  }

  function handleKeydown(event) {
    if (!state.enabled) return;

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    state.lastInteraction = now();

    if (event.key.length === 1 || event.key === "Backspace" || event.key === "Enter") {
      if (now() - state.lastReaction > 1050) {
        react("typing");
      }
    }
  }

  function handlePetPointerDown(event) {
    if (!state.enabled) return;

    state.dragging = true;
    state.dragged = false;
    state.pointerId = event.pointerId;
    state.dragOffsetX = event.clientX - state.x;
    state.dragOffsetY = event.clientY - state.y;

    state.lastInteraction = now();
    state.sleeping = false;

    character.setPointerCapture?.(event.pointerId);
    character.classList.add("is-dragging");
    setExpression("scared", 0);

    event.preventDefault();
    event.stopPropagation();
  }

  function handlePetPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;

    const dx = event.clientX - (state.x + state.dragOffsetX);
    const dy = event.clientY - (state.y + state.dragOffsetY);

    if (Math.hypot(dx, dy) > 5) state.dragged = true;

    setPosition(
      event.clientX - state.dragOffsetX,
      event.clientY - state.dragOffsetY,
      { drag: true }
    );

    gazeAt(event.clientX, event.clientY);
  }

  function handlePetPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;

    const dragged = state.dragged;

    state.dragging = false;
    state.pointerId = null;

    character.classList.remove("is-dragging", "is-moving", "is-climbing", "is-falling");
    try {
      character.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    if (dragged) {
      character.classList.add("is-landed");
      setExpression("curious", 850);
      window.setTimeout(() => character.classList.remove("is-landed"), 520);
    } else {
      react("anger", {}, true);
    }

    state.lastInteraction = now();

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

  function activityLoop() {
    if (state.enabled && !state.dragging && !document.hidden) {
      const idleFor = now() - state.lastInteraction;

      if (idleFor >= 8000 && !state.sleeping) {
        state.sleeping = true;
        setExpression("sleeping", 0);
        if (state.messages) showMessage("Zzz...", 1350);
      }

      if (!state.sleeping && now() >= state.nextBlinkAt) {
        blink();
      }

      if (!state.sleeping &&
          !state.dragging &&
          now() - state.lastMicro > 9500 &&
          Math.random() < 0.38) {
        state.lastMicro = now();

        const expressions = state.context === "study"
          ? ["focused", "thinking", "curious", "unimpressed"]
          : ["idle", "curious", "thinking", "bored"];

        const expression = state.eye === "pink" && Math.random() < .58
          ? "playful"
          : expressions[Math.floor(Math.random() * expressions.length)];

        setExpression(expression, 1150);
      }

      if (state.avoidUntil > now()) {
        fleeFromCursor();
      }
    }

    window.setTimeout(activityLoop, 900);
  }

  launcher.addEventListener("click", (event) => {
    event.stopPropagation();
    closeOtherPanels();
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

  messagesEnableButton.addEventListener("click", () => setMessages(true));
  messagesDisableButton.addEventListener("click", () => setMessages(false));

  eyeButtons.forEach((button) => {
    button.addEventListener("click", () => setEye(button.dataset.petEye));
  });

  character.addEventListener("pointerdown", handlePetPointerDown);
  character.addEventListener("pointermove", handlePetPointerMove);
  character.addEventListener("pointerup", handlePetPointerUp);
  character.addEventListener("pointercancel", handlePetPointerUp);

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
      setExpression("sleeping", 0);
      bubble.classList.remove("is-visible");
    } else {
      state.sleeping = false;
      state.lastInteraction = now();
      react("wake", {}, true);
    }
  });

  window.addEventListener("resize", () => {
    const next = clampPosition(state.x, state.y);
    setPosition(next.x, next.y, { drag: true });
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

    const current = getPageContext();

    if (current !== state.context) {
      state.context = current;

      setExpression(
        current === "study" || current === "exam"
          ? "focused"
          : state.eye === "pink"
            ? "playful"
            : "curious",
        1200
      );
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "hidden"]
  });

  state.cursorX = window.innerWidth * .72;
  state.cursorY = window.innerHeight * .52;

  updateControls();
  setPosition(state.x, state.y, { drag: true });
  gazeAt(state.cursorX, state.cursorY);

  if (state.enabled) {
    setExpression("sleepy", 900);
    if (state.messages) {
      window.setTimeout(() => showMessage("👀", 950), 850);
    }
    scheduleWander(6200);
  }

  gazeLoop();
  activityLoop();
})();