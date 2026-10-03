/* =========================================================
   StudyLab Living Pet
   EMO-inspired black display companion with procedural facial
   expressions. Global page-level only. No simulation internals.
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

  const state = {
    enabled: readBool(STORAGE.enabled, true),
    eye: readEye(),
    messages: readBool(STORAGE.messages, true),

    context: "home",
    expression: "idle",
    sleeping: false,

    x: Math.min(window.innerWidth - 100, Math.max(100, window.innerWidth * 0.72)),
    y: Math.min(window.innerHeight - 120, Math.max(120, window.innerHeight * 0.57)),

    cursorX: window.innerWidth * 0.72,
    cursorY: window.innerHeight * 0.55,

    dragging: false,
    dragged: false,
    pointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,

    lastInteraction: Date.now(),
    lastReaction: 0,
    lastMove: 0,
    lastBlink: Date.now(),
    nextBlinkAt: Date.now() + 7500 + Math.random() * 4500,
    lastAmbient: Date.now(),
    lastHover: 0,
    lastMicro: Date.now(),

    anger: 0,
    lastAngerAt: 0,
    avoidUntil: 0,
    lastFlee: 0,

    wanderTimer: 0,
    messageTimer: 0,
    resetExpressionTimer: 0,
    nameTimer: 0,
    settleTimer: 0
  };

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

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE.enabled, String(state.enabled));
      localStorage.setItem(STORAGE.eye, state.eye);
      localStorage.setItem(STORAGE.messages, String(state.messages));
    } catch (_) {}
  }

  function now() {
    return Date.now();
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
    if (path.includes("audio_books")) return "audio";

    const combined = title + " " + text;

    if (/physics/.test(combined)) return "physics";
    if (/chemistry/.test(combined)) return "chemistry";
    if (/mathematics|combined maths|combined mathematics/.test(combined)) return "maths";
    if (/biology/.test(combined)) return "biology";
    if (/past papers|marking schemes|exam hub/.test(combined)) return "exam";
    return "home";
  }

  state.context = pageContext();

  const contextMessages = {
    home: ["Hmm.", "I noticed that.", "👀"],
    physics: ["Physics.", "Watching.", "Interesting."],
    chemistry: ["🧪", "Lab mode.", "Watching."],
    maths: ["Maths.", "Numbers.", "Calculating."],
    biology: ["🧬", "Observing.", "Interesting."],
    exam: ["Exam mode.", "Serious.", "Paper hunt."],
    social: ["👀", "Community.", "I see."],
    audio: ["Listening.", "Audio time.", "I hear that."],
    study: ["Focus.", "Study mode.", "I'm watching."]
  };

  /*
   * Facial-first expression profiles.
   * Each profile combines asymmetric eye geometry, rounded-square
   * proportions, tilt and mouth geometry. Random micro-variation
   * on every transition produces thousands of distinct visual states.
   */
  const EXPRESSION_PROFILES = {
    idle:        { lw:23, lh:30, rw:23, rh:30, lr:0, rr:0, mouth:"flat",  mw:17, mh:2, my:0, mr:0 },
    curious:     { lw:26, lh:33, rw:22, rh:28, lr:-2, rr:1, mouth:"dot",   mw:7,  mh:7, my:0, mr:0 },
    happy:       { lw:24, lh:14, rw:24, rh:14, lr:0, rr:0, mouth:"smile", mw:20, mh:8, my:0, mr:0 },
    excited:     { lw:27, lh:34, rw:27, rh:34, lr:0, rr:0, mouth:"open",  mw:12, mh:11, my:0, mr:0 },
    focused:     { lw:22, lh:27, rw:22, rh:27, lr:0, rr:0, mouth:"flat",  mw:15, mh:2, my:1, mr:0 },
    thinking:    { lw:22, lh:28, rw:20, rh:25, lr:-3, rr:2, mouth:"flat",  mw:10, mh:2, my:1, mr:5 },
    surprised:   { lw:28, lh:35, rw:28, rh:35, lr:0, rr:0, mouth:"open",  mw:11, mh:11, my:0, mr:0 },
    shocked:     { lw:30, lh:36, rw:30, rh:36, lr:0, rr:0, mouth:"open",  mw:14, mh:14, my:0, mr:0 },
    scared:     { lw:28, lh:35, rw:28, rh:35, lr:-3, rr:3, mouth:"open",   mw:10, mh:10, my:1, mr:0 },
    sad:         { lw:22, lh:27, rw:22, rh:27, lr:-6, rr:6, mouth:"frown", mw:18, mh:7, my:1, mr:0 },
    worried:     { lw:23, lh:29, rw:23, rh:29, lr:-6, rr:6, mouth:"frown", mw:15, mh:6, my:1, mr:-3 },
    bored:       { lw:24, lh:10, rw:24, rh:10, lr:0, rr:0, mouth:"flat",  mw:14, mh:2, my:1, mr:0 },
    sleepy:      { lw:23, lh:8, rw:23, rh:8, lr:0, rr:0, mouth:"flat",   mw:10, mh:2, my:3, mr:0 },
    sleeping:    { lw:24, lh:4, rw:24, rh:4, lr:0, rr:0, mouth:"flat",   mw:8,  mh:2, my:4, mr:0 },
    playful:     { lw:6,  lh:6, rw:24, rh:28, lr:-4, rr:2, mouth:"grin",  mw:21, mh:9, my:0, mr:-3 },
    unimpressed: { lw:24, lh:9, rw:24, rh:9, lr:-2, rr:2, mouth:"flat",  mw:14, mh:2, my:1, mr:0 },
    annoyed:     { lw:23, lh:13, rw:23, rh:13, lr:-6, rr:6, mouth:"frown", mw:15, mh:5, my:1, mr:0 },
    angry:       { lw:24, lh:15, rw:24, rh:15, lr:-12, rr:12, mouth:"frown", mw:20, mh:5, my:2, mr:0 },
    confused:    { lw:22, lh:25, rw:18, rh:22, lr:-7, rr:7, mouth:"dot",   mw:8,  mh:8, my:0, mr:-12 },
    wink:        { lw:6,  lh:5, rw:24, rh:29, lr:-2, rr:1, mouth:"smile", mw:18, mh:7, my:0, mr:-2 },
    smug:        { lw:23, lh:13, rw:21, rh:25, lr:-4, rr:2, mouth:"grin",  mw:17, mh:7, my:0, mr:2 },
    dizzy:       { lw:20, lh:20, rw:20, rh:20, lr:20, rr:-20, mouth:"dot",  mw:7, mh:7, my:0, mr:0 },
    deadpan:     { lw:24, lh:7, rw:24, rh:7, lr:0, rr:0, mouth:"flat",  mw:15, mh:2, my:0, mr:0 },
    proud:       { lw:23, lh:25, rw:23, rh:25, lr:-3, rr:3, mouth:"grin", mw:19, mh:8, my:0, mr:0 }
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
        data-mouth="flat"
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
        <button class="sl-pet-panel-close" type="button" data-pet-close aria-label="Close pet controls">×</button>
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
        <div class="sl-pet-setting-buttons" role="group" aria-label="Pet messages state">
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
        EMO-inspired display eyes, slow wandering, cursor attention, sleep, drag-and-place,
        contextual expressions and sparse messages.
      </p>
    </aside>
  `);

  const stage = document.getElementById("studylabPetStage");
  const character = stage.querySelector(".sl-pet-character");
  const bubble = stage.querySelector("[data-pet-bubble]");
  const eyeShells = [...stage.querySelectorAll(".sl-pet-eye")];
  const eyes = [...stage.querySelectorAll(".sl-pet-eye > i")];

  const launcher = document.getElementById("studylabPetLauncher");
  const panel = document.getElementById("studylabPetPanel");
  const closeButton = panel.querySelector("[data-pet-close]");
  const enableButton = panel.querySelector("[data-pet-enable]");
  const disableButton = panel.querySelector("[data-pet-disable]");
  const messagesEnableButton = panel.querySelector("[data-pet-messages-enable]");
  const messagesDisableButton = panel.querySelector("[data-pet-messages-disable]");
  const eyeButtons = [...panel.querySelectorAll("[data-pet-eye]")];

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
    const rectW = window.innerWidth;
    const rectH = window.innerHeight;
    const halfW = 54;
    const halfH = 39;

    return {
      x: Math.max(halfW + 8, Math.min(rectW - halfW - 8, x)),
      y: Math.max(halfH + 8, Math.min(rectH - halfH - 20, y))
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

        if (dy < -22) {
          const duration = 7000 + Math.min(2800, Math.abs(dy) * 6);
          character.style.setProperty("--pet-move-duration", Math.round(duration) + "ms");
          character.style.setProperty("--pet-move-ease", "cubic-bezier(.24,.57,.18,1)");
          character.classList.remove("is-moving", "is-falling", "is-landed");
          character.classList.add("is-climbing");
          applyMovementFace("hard");
        } else if (dy > 22) {
          const duration = 2500 + Math.min(1300, Math.abs(dy) * 2.2);
          character.style.setProperty("--pet-move-duration", Math.round(duration) + "ms");
          character.style.setProperty("--pet-move-ease", "cubic-bezier(.14,.90,.25,1.18)");
          character.classList.remove("is-moving", "is-climbing", "is-landed");
          character.classList.add("is-falling");
          applyMovementFace("down");
        } else {
          const duration = 5600 + Math.random() * 2200;
          character.style.setProperty("--pet-move-duration", Math.round(duration) + "ms");
          character.style.setProperty("--pet-move-ease", "cubic-bezier(.20,.72,.20,1)");
          character.classList.remove("is-climbing", "is-falling", "is-landed");
          character.classList.add("is-moving");
          applyMovementFace("walk");
        }

        window.clearTimeout(state.settleTimer);

        if (dy > 22) {
          state.settleTimer = window.setTimeout(() => {
            if (!state.dragging && state.enabled) {
              character.classList.remove("is-falling");
              character.classList.add("is-landed");
              window.setTimeout(() => {
                character.classList.remove("is-landed");
                restoreExpressionFace();
              }, 520);
            }
          }, parseInt(character.style.getPropertyValue("--pet-move-duration"), 10) + 60);
        }

        window.setTimeout(() => {
          if (!state.dragging && state.enabled) {
            character.classList.remove("is-moving", "is-climbing");
            restoreExpressionFace();
          }
        }, parseInt(character.style.getPropertyValue("--pet-move-duration"), 10) + 90);
      }
    }

    state.x = next.x;
    state.y = next.y;
    character.style.left = next.x + "px";
    character.style.top = next.y + "px";
    bubble.style.left = next.x + "px";
    bubble.style.top = Math.max(80, next.y - 42) + "px";
  }

  function applyMovementFace(mode) {
    const values = mode === "hard"
      ? { width: 14, height: 18, radius: 5 }
      : mode === "walk"
        ? { width: 17, height: 22, radius: 6 }
        : { width: 20, height: 25, radius: 7 };

    eyes.forEach((eye) => {
      eye.style.setProperty("--eye-width", values.width + "px");
      eye.style.setProperty("--eye-height", values.height + "px");
      eye.style.setProperty("--eye-radius", values.radius + "px");
    });

    character.style.setProperty("--mouth-opacity", mode === "hard" ? ".42" : ".65");
  }

  function restoreExpressionFace() {
    if (!state.enabled) return;
    setExpression(state.expression, 0, true);
  }

  function chooseWanderTarget() {
    const study = state.context === "study";
    const longMove = Math.random() < (study ? 0.15 : 0.10);

    if (longMove) {
      return clampPosition(
        70 + Math.random() * Math.max(1, window.innerWidth - 140),
        88 + Math.random() * Math.max(1, window.innerHeight - 180)
      );
    }

    const distance = 60 + Math.random() * (study ? 75 : 55);
    const angle = Math.random() * Math.PI * 2;

    return clampPosition(
      state.x + Math.cos(angle) * distance,
      state.y + Math.sin(angle) * distance * .62
    );
  }

  function scheduleWander(delay) {
    window.clearTimeout(state.wanderTimer);

    state.wanderTimer = window.setTimeout(() => {
      if (!state.enabled || state.sleeping || state.dragging || document.hidden) {
        scheduleWander(state.sleeping ? 5000 : 8000);
        return;
      }

      if (now() - state.lastMove < 7500) {
        scheduleWander(9000);
        return;
      }

      if (Math.random() < (state.context === "study" ? .70 : .52)) {
        const target = chooseWanderTarget();
        setPosition(target.x, target.y);
      }

      scheduleWander(
        state.context === "study"
          ? 12000 + Math.random() * 8500
          : 17500 + Math.random() * 10500
      );
    }, delay);
  }

  function showMessage(message, duration = 1450) {
    if (!state.enabled || !state.messages) return;

    bubble.textContent = message;
    bubble.classList.add("is-visible");

    window.clearTimeout(state.messageTimer);
    state.messageTimer = window.setTimeout(() => {
      bubble.classList.remove("is-visible");
    }, duration);
  }

  function maybeMessage(pool, chance = .10) {
    if (!state.messages || Math.random() > chance) return;
    if (bubble.classList.contains("is-visible")) return;
    showMessage(pool[Math.floor(Math.random() * pool.length)]);
  }

  function applyEyeValues(eye, profile, side, variant) {
    const jitter = (amount) => (Math.random() * 2 - 1) * amount;

    const baseW = side === "left" ? profile.lw : profile.rw;
    const baseH = side === "left" ? profile.lh : profile.rh;
    const baseR = Math.max(4, Math.round(Math.min(baseW, baseH) * .25));

    eye.style.setProperty("--eye-width", Math.max(4, baseW + jitter(1.5) + variant.eyeScaleW) + "px");
    eye.style.setProperty("--eye-height", Math.max(4, baseH + jitter(1.6) + variant.eyeScaleH) + "px");
    eye.style.setProperty("--eye-radius", Math.max(3, baseR + jitter(1.3) + variant.radius) + "px");
    eye.style.setProperty("--eye-x", (jitter(.9) + variant.offsetX) + "px");
    eye.style.setProperty("--eye-y", (jitter(.8) + variant.offsetY) + "px");
    eye.style.setProperty("--eye-rotate", ((side === "left" ? profile.lr : profile.rr) + jitter(1.2) + variant.rotate) + "deg");
    eye.style.setProperty("--eye-scale-x", (1 + jitter(.035)) .toFixed(3));
    eye.style.setProperty("--eye-scale-y", (1 + jitter(.035)) .toFixed(3));
    eye.style.setProperty("--eye-highlight", (.20 + Math.random() * .18).toFixed(2));
  }

  function setExpression(expression, duration = 0, restoring = false) {
    if (!state.enabled) return;

    const chosen = EXPRESSION_PROFILES[expression] || EXPRESSION_PROFILES.idle;

    state.expression = expression;
    state.expressionVariant++;

    character.dataset.expression = expression;
    character.dataset.mouth = chosen.mouth;

    const variant = {
      eyeScaleW: (Math.random() * 2 - 1) * 1.8,
      eyeScaleH: (Math.random() * 2 - 1) * 2.1,
      radius: (Math.random() * 2 - 1) * 1.0,
      offsetX: (Math.random() * 2 - 1) * 1.3,
      offsetY: (Math.random() * 2 - 1) * 1.1,
      rotate: (Math.random() * 2 - 1) * (expression === "angry" ? 2.8 : 2.0)
    };

    applyEyeValues(eyes[0], chosen, "left", variant);
    applyEyeValues(eyes[1], chosen, "right", variant);

    character.style.setProperty("--mouth-width", Math.max(2, chosen.mw + (Math.random() * 2 - 1) * 2.0) + "px");
    character.style.setProperty("--mouth-height", Math.max(2, chosen.mh + (Math.random() * 2 - 1) * 1.5) + "px");
    character.style.setProperty("--mouth-y", (chosen.my + (Math.random() * 2 - 1) * .8) + "px");
    character.style.setProperty("--mouth-rotate", (chosen.mr + (Math.random() * 2 - 1) * 3) + "deg");
    character.style.setProperty("--mouth-opacity", expression === "sleeping" ? ".48" : "1");

    if (duration > 0 && !restoring) {
      window.clearTimeout(state.resetExpressionTimer);
      state.resetExpressionTimer = window.setTimeout(() => {
        if (!state.sleeping && !state.dragging && state.enabled) {
          setExpression("idle");
        }
      }, duration);
    }
  }

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging) return;

    state.lastBlink = now();
    state.nextBlinkAt = now() + 7500 + Math.random() * 4500;
    character.classList.add("is-blinking");

    window.setTimeout(() => {
      if (state.enabled && !state.sleeping && !state.dragging) {
        character.classList.remove("is-blinking");
        restoreExpressionFace();
      }
    }, 180);
  }

  function gazeAt(x, y) {
    if (!state.enabled) return;

    const dx = Math.max(-1, Math.min(1, (x - state.x) / 210));
    const dy = Math.max(-1, Math.min(1, (y - state.y) / 160));

    const gx = dx * 6.0;
    const gy = dy * 5.0;

    character.style.setProperty("--gaze-x-target", gx + "px");
    character.style.setProperty("--gaze-y-target", gy + "px");
  }

  let gazeX = 0;
  let gazeY = 0;
  function gazeLoop() {
    if (state.enabled) {
      const targetX = parseFloat(getComputedStyle(character).getPropertyValue("--gaze-x-target")) || 0;
      const targetY = parseFloat(getComputedStyle(character).getPropertyValue("--gaze-y-target")) || 0;

      gazeX += (targetX - gazeX) * .08;
      gazeY += (targetY - gazeY) * .08;

      eyes.forEach((eye) => {
        eye.style.setProperty("--gaze-x", gazeX.toFixed(2) + "px");
        eye.style.setProperty("--gaze-y", gazeY.toFixed(2) + "px");
      });
    }

    window.requestAnimationFrame(gazeLoop);
  }

  function react(type, detail = {}, force = false) {
    if (!state.enabled && !force) return;

    const t = now();
    if (!force && t - state.lastReaction < 430) return;

    state.lastReaction = t;
    state.lastInteraction = t;
    state.sleeping = false;

    if (type === "wake") {
      setExpression("sleepy", 450);
      window.setTimeout(() => {
        if (state.enabled && !state.sleeping) {
          setExpression(state.eye === "pink" ? "playful" : "curious", 800);
        }
      }, 330);
      return;
    }

    if (type === "hover-card") {
      const context = detail.context || state.context;
      const utility = detail.element ? utilityKind(detail.element) : "";

      if (context === "study") {
        const map = {
          pomodoro: ["focused", "thinking", "proud"],
          flashcard: ["curious", "surprised", "wink"],
          mistake: ["confused", "worried", "sad"],
          marks: ["surprised", "thinking", "shocked"],
          planner: ["thinking", "focused", "proud"],
          mock: ["focused", "worried", "deadpan"],
          converter: ["curious", "thinking", "happy"]
        };

        const options = map[utility] || ["curious", "focused", "thinking", "playful"];
        const chosen = options[Math.floor(Math.random() * options.length)];
        setExpression(chosen, 1150);
      } else {
        const map = {
          chemistry: ["excited", "curious", "surprised"],
          physics: ["curious", "focused", "surprised"],
          maths: ["thinking", "curious", "unimpressed"],
          biology: ["curious", "happy", "surprised"],
          exam: ["focused", "worried", "deadpan"],
          social: ["curious", "playful"],
          audio: ["curious", "happy"],
          home: ["curious", "idle", "playful"]
        };

        const options = map[context] || map.home;
        setExpression(options[Math.floor(Math.random() * options.length)], 1100);
      }

      const pool = contextMessages[context];
      if (pool) maybeMessage(pool, .09);
      return;
    }

    if (type === "click-card") {
      const context = detail.context || state.context;
      const utility = detail.element ? utilityKind(detail.element) : "";

      if (context === "study") {
        if (utility === "pomodoro" || utility === "mock") setExpression("focused", 1800);
        else if (utility === "flashcard") setExpression("curious", 1100);
        else if (utility === "mistake") setExpression("confused", 1200);
        else if (utility === "marks") setExpression("surprised", 1050);
        else setExpression(state.eye === "pink" ? "playful" : "focused", 1050);
      } else if (context === "chemistry") {
        setExpression("excited", 1200);
      } else if (context === "physics") {
        setExpression("curious", 1100);
      } else if (context === "maths") {
        setExpression("thinking", 1200);
      } else if (context === "biology") {
        setExpression("happy", 1100);
      } else if (context === "exam") {
        setExpression("focused", 1400);
      } else {
        setExpression(state.eye === "pink" ? "playful" : "happy", 1000);
      }
      return;
    }

    if (type === "typing") {
      setExpression("curious", 850);
      if (detail.name) maybeMessage(["👀", "Hmm?", "I see."], .12);
      return;
    }

    if (type === "name-complete") {
      setExpression(state.eye === "pink" ? "happy" : "excited", 1350);
      maybeMessage(["Hi. 👋", "Nice to meet you.", "I noticed your name."], .45);
      return;
    }

    if (type === "theme") {
      setExpression("surprised", 750);
      return;
    }

    if (type === "scroll") {
      setExpression(state.eye === "pink" ? "playful" : "curious", 650);
      return;
    }

    if (type === "scared") {
      setExpression("scared", 0);
      character.classList.add("is-dragging");
      return;
    }

    if (type === "anger") {
      const recent = t - state.lastAngerAt < 5600;

      state.anger = Math.min(
        4,
        recent ? state.anger + 1 : Math.max(1, state.anger)
      );
      state.lastAngerAt = t;
      state.avoidUntil = t + 4300 + state.anger * 520;

      setExpression("angry", 1450);

      if (state.messages) {
        if (state.anger >= 4) showMessage("...", 1100);
        else if (state.anger >= 3) showMessage("Stop.", 1050);
        else showMessage("Hey.", 950);
      }

      fleeFromCursor(true);

      window.setTimeout(() => {
        if (state.enabled && !state.dragging && !state.sleeping) {
          setExpression("annoyed", 700);
        }
      }, 1500);
      return;
    }
  }

  function fleeFromCursor(force = false) {
    if (!state.enabled || state.dragging || state.sleeping) return;

    const distance = Math.hypot(
      state.cursorX - state.x,
      state.cursorY - state.y
    );

    if (!force && now() > state.avoidUntil) return;
    if (!force && distance > 160) return;
    if (!force && now() - state.lastFlee < 1300) return;

    state.lastFlee = now();

    let angle = Math.atan2(
      state.y - state.cursorY,
      state.x - state.cursorX
    );

    if (!Number.isFinite(angle)) angle = Math.random() * Math.PI * 2;

    const distanceOut = 145 + Math.random() * 100;

    const target = clampPosition(
      state.x + Math.cos(angle) * distanceOut,
      state.y + Math.sin(angle) * distanceOut * .68
    );

    character.classList.remove("is-moving", "is-climbing", "is-falling", "is-landed");
    character.style.setProperty("--pet-move-duration", "2300ms");
    character.style.setProperty("--pet-move-ease", "cubic-bezier(.18,.85,.20,1)");
    character.classList.add("is-moving");
    applyMovementFace("walk");
    setPosition(target.x, target.y);

    window.setTimeout(() => {
      if (state.enabled && !state.dragging) {
        character.classList.remove("is-moving");
        restoreExpressionFace();
      }
    }, 2400);
  }

  function handlePointerMove(event) {
    if (!state.enabled) return;

    state.cursorX = event.clientX;
    state.cursorY = event.clientY;
    state.lastInteraction = now();

    gazeAt(event.clientX, event.clientY);

    if (state.sleeping) {
      state.sleeping = false;
      react("wake", {}, true);
    }

    if (state.avoidUntil > now()) {
      fleeFromCursor();
      return;
    }

    const distance = Math.hypot(
      event.clientX - state.x,
      event.clientY - state.y
    );

    if (distance < 78 && now() - state.lastReaction > 1350) {
      setExpression(state.eye === "pink" ? "playful" : "curious", 720);
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
      ) || utility
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
    } else if (now() - state.lastReaction > 1100) {
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

    if (now() - state.lastReaction > 1300) {
      react("scroll");
    }
  }

  function handleKeydown(event) {
    if (!state.enabled) return;

    state.lastInteraction = now();

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === "Backspace" || event.key.length === 1) {
      if (now() - state.lastReaction > 1100) {
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
    react("scared", {}, true);

    event.preventDefault();
    event.stopPropagation();
  }

  function handlePetPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;

    const proposedX = event.clientX - state.dragOffsetX;
    const proposedY = event.clientY - state.dragOffsetY;

    if (
      Math.hypot(
        proposedX - state.x,
        proposedY - state.y
      ) > 5
    ) {
      state.dragged = true;
    }

    setPosition(proposedX, proposedY, { drag: true });
    gazeAt(event.clientX, event.clientY);
    state.lastInteraction = now();
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
      setExpression("curious", 900);
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

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    state.sleeping = false;
    state.avoidUntil = 0;
    state.lastInteraction = now();

    if (!state.enabled) {
      bubble.classList.remove("is-visible");
      character.dataset.expression = "idle";
      character.dataset.mouth = "flat";
      character.classList.remove(
        "is-moving",
        "is-climbing",
        "is-falling",
        "is-landed",
        "is-dragging",
        "is-blinking"
      );
      window.clearTimeout(state.wanderTimer);
    } else {
      state.context = pageContext();
      setExpression("sleepy", 500);
      showMessage("I'm back. 👀", 1300);
      scheduleWander(4500);
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
      showMessage("Message mode on.", 1050);
    }
  }

  function setEye(eye) {
    state.eye = eye === "pink" ? "pink" : "cyan";
    updateControls();
    savePreferences();

    if (!state.enabled) return;

    setExpression(state.eye === "pink" ? "playful" : "excited", 950);
    maybeMessage([state.eye === "pink" ? "🩷" : "🩵"], 1);
  }

  launcher.addEventListener("click", (event) => {
    event.stopPropagation();
    closeOtherPanels();
    setOpen(panel.hidden);
  });

  closeButton.addEventListener("click", () => setOpen(false));
  enableButton.addEventListener("click", () => { setEnabled(true); setOpen(false); });
  disableButton.addEventListener("click", () => { setEnabled(false); setOpen(false); });

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
    const p = clampPosition(state.x, state.y);
    setPosition(p.x, p.y, { drag: true });
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
      setExpression(
        current === "study" || current === "exam"
          ? "focused"
          : "curious",
        1250
      );
      scheduleWander(current === "study" ? 5000 : 8000);
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
      const idleFor = now() - state.lastInteraction;

      if (idleFor >= 8000 && !state.sleeping) {
        state.sleeping = true;
        setExpression("sleeping", 0);
        if (state.messages) showMessage("Zzz...", 1450);
      }

      if (!state.sleeping && now() >= state.nextBlinkAt) {
        blink();
      }

      if (!state.sleeping &&
          now() - state.lastMicro > 7200 &&
          Math.random() < .25) {
        state.lastMicro = now();

        const ambientExpressions = state.context === "study"
          ? ["focused", "thinking", "curious", "unimpressed", "proud"]
          : ["idle", "curious", "thinking", "bored", "playful", "deadpan"];

        const chosen =
          state.eye === "pink" && Math.random() < .35
            ? "playful"
            : ambientExpressions[Math.floor(Math.random() * ambientExpressions.length)];

        setExpression(chosen, 1250);
      }

      if (!state.sleeping &&
          now() - state.lastAmbient > (state.context === "study" ? 6500 : 10500) &&
          Math.random() < (state.context === "study" ? .08 : .035)) {
        state.lastAmbient = now();

        const ambientPool = contextMessages[state.context] || contextMessages.home;
        maybeMessage(ambientPool, 1);
      }

      if (state.avoidUntil > now()) {
        fleeFromCursor();
      }
    }

    window.setTimeout(activityLoop, 1000);
  }

  updateControls();
  setPosition(state.x, state.y, { drag: true });
  gazeAt(state.cursorX, state.cursorY);

  if (state.enabled) {
    setExpression("idle", 0);
    window.setTimeout(() => react("wake", {}, true), 700);
    scheduleWander(7000);
  }

  gazeLoop();
  activityLoop();

  window.setInterval(() => {
    if (state.anger > 0 && now() - state.lastAngerAt > 6500) {
      state.anger = Math.max(0, state.anger - 1);
    }
  }, 2200);
})();