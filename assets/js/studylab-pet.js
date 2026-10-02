/* =========================================================
   StudyLab Living Pet — active companion engine
   Global/page-level companion only. No simulation integration.
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

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  };

  const save = (key, value) => {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  };

  const bool = (key, fallback) => read(key, String(fallback)) === "true";
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (items) => items[Math.floor(Math.random() * items.length)];

  const state = {
    enabled: bool(KEY.enabled, true),
    eye: read(KEY.eye, "cyan") === "pink" ? "pink" : "cyan",
    context: "home",
    expression: "neutral",
    sleeping: false,
    dragging: false,
    danger: false,
    evading: false,

    x: 0,
    y: 0,
    moveAnimation: 0,
    moveToken: 0,

    pointerX: window.innerWidth * 0.72,
    pointerY: window.innerHeight * 0.52,
    gazeX: 0,
    gazeY: 0,
    gazeTargetX: 0,
    gazeTargetY: 0,

    lastActivity: now(),
    lastMeaningfulActivity: now(),
    lastReaction: 0,
    lastWander: 0,

    nextBlink: now() + rand(6500, 10400),
    nextWander: now() + rand(9000, 15000),
    nextAmbient: now() + rand(10000, 18000),

    clickTimes: [],
    angerLevel: 0,
    angerUntil: 0,
    angerTimer: null,
    nextEvade: 0,

    dragPointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    pressX: 0,
    pressY: 0,
    pointerMoved: false,

    reactionTimer: null,
    bubbleTimer: null,
    blinkTimer: null,
    lastHoveredElement: null
  };

  state.x = clamp(
    Number(read(KEY.x, Math.round(window.innerWidth * 0.72))) || window.innerWidth * 0.72,
    50,
    window.innerWidth - 50
  );
  state.y = clamp(
    Number(read(KEY.y, Math.round(window.innerHeight * 0.53))) || window.innerHeight * 0.53,
    76,
    window.innerHeight - 82
  );

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "assets/css/studylab-pet.css";
  document.head.appendChild(link);

  document.body.insertAdjacentHTML("beforeend",
    '<div id="studylabPetStage">' +
      '<div class="sl-pet-character" data-state="neutral" data-eye="cyan" data-danger="false" data-blink="false" data-moving="false" data-direction="idle" role="button" tabindex="0" aria-label="StudyLab Pet">' +
        '<div class="sl-pet-visual">' +
          '<div class="sl-pet-face" aria-hidden="true">' +
            '<div class="sl-pet-eye left"><i></i></div>' +
            '<div class="sl-pet-eye right"><i></i></div>' +
            '<div class="sl-pet-mouth" aria-hidden="true"></div>' +
          '</div>' +
          '<svg class="sl-pet-crack" viewBox="0 0 32 26" aria-hidden="true">' +
            '<path d="M26 2L20 8L22 11L16 14L18 18L11 24"></path>' +
            '<path d="M20 8L26 9"></path>' +
          '</svg>' +
          '<div class="sl-pet-zzz" aria-hidden="true"><span>Z</span><span>z</span><span>z</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="sl-pet-thought" data-pet-thought aria-hidden="true">' +
        '<span class="sl-pet-thought-dot d1"></span>' +
        '<span class="sl-pet-thought-dot d2"></span>' +
        '<div class="sl-pet-thought-cloud"><b data-pet-thought-text>...</b></div>' +
      '</div>' +
    '</div>' +

    '<button id="studylabPetLauncher" type="button" aria-expanded="false" aria-controls="studylabPetPanel" title="StudyLab Pet controls">' +
      '<span class="sl-pet-launcher-icon" aria-hidden="true">🤖</span><span>Pet</span>' +
    '</button>' +

    '<aside class="sl-pet-panel" id="studylabPetPanel" hidden aria-label="StudyLab Pet controls">' +
      '<div class="sl-pet-panel-head">' +
        '<div><strong>StudyLab Pet</strong><small>Your little study companion</small></div>' +
        '<button class="sl-pet-panel-close" type="button" data-pet-close aria-label="Close pet controls">×</button>' +
      '</div>' +
      '<div class="sl-pet-setting"><span>Pet</span><div class="sl-pet-setting-buttons">' +
        '<button type="button" data-pet-enable>Enable</button><button type="button" data-pet-disable>Disable</button>' +
      '</div></div>' +
      '<div class="sl-pet-setting"><span>Eye colour</span><div class="sl-pet-setting-buttons">' +
        '<button type="button" data-pet-eye="cyan">Cyan</button><button type="button" data-pet-eye="pink">Pink</button>' +
      '</div></div>' +
      '<p class="sl-pet-panel-note">Cyan and Pink are two tiny personalities. Watch the face, gaze, walking and thoughts.</p>' +
    '</aside>'
  );

  const stage = document.getElementById("studylabPetStage");
  const character = stage.querySelector(".sl-pet-character");
  const visual = stage.querySelector(".sl-pet-visual");
  const eyes = [...stage.querySelectorAll(".sl-pet-eye > i")];
  const thought = stage.querySelector("[data-pet-thought]");
  const thoughtText = stage.querySelector("[data-pet-thought-text]");
  const launcher = document.getElementById("studylabPetLauncher");
  const panel = document.getElementById("studylabPetPanel");
  const closeButton = panel.querySelector("[data-pet-close]");
  const enableButton = panel.querySelector("[data-pet-enable]");
  const disableButton = panel.querySelector("[data-pet-disable]");
  const eyeButtons = [...panel.querySelectorAll("[data-pet-eye]")];

  function setPosition(x, y) {
    const halfW = window.innerWidth <= 720 ? 41 : 45;
    const minY = 74;
    const maxY = Math.max(minY + 20, window.innerHeight - 82);

    state.x = clamp(x, halfW, window.innerWidth - halfW);
    state.y = clamp(y, minY, maxY);

    character.style.transform =
      "translate3d(" + state.x + "px, " + state.y + "px, 0) translate(-50%, -50%)";

    if (thought.classList.contains("is-visible")) {
      placeThought();
    }

  }

  setPosition(state.x, state.y);

  function wake(reason) {
    state.lastActivity = now();
    if (!state.sleeping) return;
    state.sleeping = false;
    character.dataset.state = "curious";
    state.expression = "curious";
    state.nextBlink = now() + rand(2800, 5200);
  }

  function placeThought() {
    const cloudWidth = window.innerWidth <= 720 ? 175 : 190;
    const petHalfHeight = window.innerWidth <= 720 ? 32 : 35;
    const anchorX = clamp(
      state.x - cloudWidth / 2,
      10,
      Math.max(10, window.innerWidth - cloudWidth - 10)
    );
    thought.style.left = anchorX + "px";
    thought.style.top = Math.max(58, state.y - petHalfHeight - 8) + "px";
  }

  function showThought(message, duration = 1800) {
    if (!state.enabled || !message) return;
    thoughtText.textContent = message;
    placeThought();
    thought.classList.add("is-visible");
    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(() => thought.classList.remove("is-visible"), duration);
  }

  function hideThought() {
    thought.classList.remove("is-visible");
  }

  const expressionNames = [
    "neutral", "curious", "happy", "excited", "focused", "thinking",
    "alert", "worried", "confused", "suspicious", "bored", "sleeping",
    "angry", "scared", "annoyed", "delighted", "surprised", "shy"
  ];

  function setExpression(name, ttl = 1300, force = false) {
    if (!state.enabled && !force) return;

    const next = expressionNames.includes(name) ? name : "neutral";
    state.expression = next;
    character.dataset.state = state.sleeping ? "sleeping" : next;
    character.dataset.micro = String(Math.floor(Math.random() * 24));

    clearTimeout(state.reactionTimer);
    if (ttl > 0) {
      state.reactionTimer = setTimeout(() => {
        if (!state.dragging && !state.sleeping && now() > state.angerUntil) {
          state.expression = "neutral";
          character.dataset.state = "neutral";
        }
      }, ttl);
    }
  }

  function contextFromPath() {
    const path = location.pathname.toLowerCase();
    if (path.includes("study-tools")) return "study";
    if (path.includes("physics")) return "physics";
    if (path.includes("chemistry")) return "chemistry";
    if (path.includes("maths")) return "maths";
    if (path.includes("biology")) return "biology";
    if (path.includes("exam-hub")) return "exam";
    if (path.includes("telegram")) return "social";
    return "home";
  }

  state.context = contextFromPath();

  const contextMoods = {
    home: ["curious", "calm", "neutral"],
    physics: ["alert", "focused", "excited"],
    chemistry: ["curious", "delighted", "focused"],
    maths: ["thinking", "focused", "suspicious"],
    biology: ["curious", "delighted", "alert"],
    study: ["focused", "thinking", "curious"],
    exam: ["alert", "focused", "worried"],
    social: ["happy", "delighted", "curious"]
  };

  const contextThoughts = {
    home: "Open it.",
    physics: "Open physics.",
    chemistry: "Open chemistry.",
    maths: "Open maths.",
    biology: "Open biology.",
    study: "Open this tool.",
    exam: "Open exam material.",
    social: "Open community."
  };

  const utilityMap = [
    { re: /pomodoro|focus timer/, expression: "focused", thought: "Focus mode." },
    { re: /flashcard|flash card/, expression: "curious", thought: "What's next?" },
    { re: /mistake|mistakes|error notebook/, expression: "worried", thought: "Fix that one." },
    { re: /planner|study plan|plan/, expression: "thinking", thought: "Plan first." },
    { re: /marks|calculator|calculat/, expression: "thinking", thought: "Let's calculate." },
    { re: /mock exam|exam timer|quiz/, expression: "alert", thought: "Clock's ticking." },
    { re: /converter|convert/, expression: "curious", thought: "Unit swap." }
  ];

  const elementMap = [
    { re: /theme|dark mode|light mode/, expression: "surprised", thought: "New lighting." },
    { re: /search/, expression: "curious", thought: "Looking..." },
    { re: /profile|account|name/, expression: "curious", thought: "Who's that?" },
    { re: /telegram|community|channel/, expression: "happy", thought: "Messages." },
    { re: /past paper|marking scheme|model paper|school paper/, expression: "focused", thought: "Exam stuff." },
    { re: /simulation|simulat|interactive/, expression: "excited", thought: "Let's play." },
    { re: /practical|laboratory|lab/, expression: "delighted", thought: "Experiment." },
    { re: /physics|doppler|gravity|wave|electricity|motion|force/, expression: "alert", thought: "Physics." },
    { re: /chemistry|chemical|organic|inorganic|reaction|titration/, expression: "curious", thought: "Chemistry." },
    { re: /maths|mathematics|trigonometry|calculus|vector|algebra/, expression: "thinking", thought: "Numbers." },
    { re: /biology|genetics|cell|ecology|organism/, expression: "curious", thought: "Observe..." },
    { re: /download|pdf|open|view/, expression: "focused", thought: "Let's see." },
    { re: /save|favorite|favourite|bookmark/, expression: "happy", thought: "Keeping it." },
    { re: /delete|remove|reset|clear/, expression: "worried", thought: "Careful..." },
    { re: /submit|finish|complete|start/, expression: "alert", thought: "Go." }
  ];

  function descriptor(el) {
    if (!el) return "";
    return [
      el.id || "",
      typeof el.className === "string" ? el.className : "",
      el.getAttribute("aria-label") || "",
      el.getAttribute("title") || "",
      el.getAttribute("data-tool") || "",
      el.getAttribute("href") || "",
      el.textContent || ""
    ].join(" ").replace(/\s+/g, " ").toLowerCase();
  }

  function elementName(el) {
    if (!el) return "this";

    const preferred =
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.getAttribute("data-tool");

    if (preferred && preferred.trim().length >= 2) {
      return preferred.trim().replace(/\s+/g, " ").slice(0, 72);
    }

    const heading = el.querySelector?.(
      "h1,h2,h3,h4,h5,h6,.card-title,.utility-card-title,.subject-title,.tool-title,strong,b"
    );
    const headingText = heading?.textContent?.trim().replace(/\s+/g, " ");
    if (headingText && headingText.length >= 2) return headingText.slice(0, 72);

    const raw = (el.textContent || "").trim().replace(/\s+/g, " ");
    return raw.slice(0, 72) || "this";
  }

  function namedThought(name, hint) {
    const cleanName = String(name || "").trim().replace(/\s+/g, " ").slice(0, 72);
    const cleanHint = String(hint || "").trim();

    if (!cleanName || cleanName === "this") return cleanHint || "Hmm...";
    if (!cleanHint || /^(physics|chemistry|maths|biology|study|exam|social)[:.]?$/i.test(cleanHint)) {
      return cleanName;
    }
    return cleanHint + " • " + cleanName;
  }

  function infoFor(el) {
    const text = descriptor(el);
    const name = elementName(el);

    const utility = utilityMap.find((item) => item.re.test(text));
    if (utility) return {
      expression: utility.expression,
      thought: namedThought(name, utility.thought)
    };

    const matched = elementMap.find((item) => item.re.test(text));
    if (matched) return {
      expression: matched.expression,
      thought: namedThought(name, matched.thought)
    };

    const context = contextFromElement(el) || state.context;
    return {
      expression: pick(contextMoods[context] || ["neutral"]),
      thought: namedThought(name, contextThoughts[context] || "Open it.")
    };
  }

  function contextFromElement(el) {
    const text = descriptor(el);
    if (!text) return state.context;
    if (/pomodoro|focus timer|flashcard|mistake|planner|marks calculator|mock exam|converter/.test(text)) return "study";
    if (/physics|doppler|gravity|wave|electricity|force|motion/.test(text)) return "physics";
    if (/chemistry|chemical|practical|laboratory|reaction|titration/.test(text)) return "chemistry";
    if (/maths|mathematics|trigonometry|calculus|vector|algebra/.test(text)) return "maths";
    if (/biology|genetics|cell|ecology|organism/.test(text)) return "biology";
    if (/exam|past paper|marking scheme|model paper|school paper|timetable/.test(text)) return "exam";
    if (/telegram|community|channel/.test(text)) return "social";
    return state.context;
  }

  function personaVariation(base) {
    if (state.eye === "cyan") {
      const boyish = {
        neutral: ["neutral", "suspicious", "calm"],
        curious: ["curious", "alert"],
        happy: ["happy", "excited"],
        thinking: ["thinking", "focused"],
        delighted: ["delighted", "excited"]
      };
      const pool = boyish[base];
      return pool ? pick(pool) : base;
    }

    const girlish = {
      neutral: ["neutral", "shy", "curious"],
      curious: ["curious", "shy", "happy"],
      happy: ["happy", "delighted"],
      thinking: ["thinking", "curious"],
      delighted: ["delighted", "happy", "shy"]
    };
    const pool = girlish[base];
    return pool ? pick(pool) : base;
  }

  function reactToElement(el, type) {
    if (!state.enabled || !el || el === character || character.contains(el) || el === launcher || panel.contains(el)) return;

    const time = now();
    if (time - state.lastReaction < (type === "hover" ? 1250 : 350)) return;

    state.lastReaction = time;
    state.lastActivity = time;
    state.lastMeaningfulActivity = time;
    wake("pointer");

    const info = infoFor(el);
    const expression = personaVariation(info.expression || "neutral");

    if (type === "click") {
      setExpression(expression, 1550);
      showThought(info.thought || "Open it.", 1450);
    } else {
      setExpression(expression, 900);
    }

    lookAtElement(el);
  }

  function lookAtElement(el) {
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    setGazeTarget(targetX, targetY, false);
  }

  function setGazeTarget(x, y, reversed) {
    const dx = x - state.x;
    const dy = y - state.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const scale = clamp(distance / 170, 0.45, 1);

    let gx = clamp(dx / 130, -1, 1) * 6.5 * scale;
    let gy = clamp(dy / 110, -1, 1) * 5.8 * scale;

    if (reversed) {
      gx *= -1.18;
      gy *= -1.18;
    }

    state.gazeTargetX = clamp(gx, -7.2, 7.2);
    state.gazeTargetY = clamp(gy, -6.2, 6.2);
  }

  function updateGaze() {
    if (state.enabled && !state.dragging && !state.sleeping && !state.evading) {
      setGazeTarget(
        state.pointerX,
        state.pointerY,
        state.angerUntil > now()
      );
    }

    state.gazeX += (state.gazeTargetX - state.gazeX) * 0.14;
    state.gazeY += (state.gazeTargetY - state.gazeY) * 0.14;

    character.style.setProperty("--gaze-x", state.gazeX.toFixed(2) + "px");
    character.style.setProperty("--gaze-y", state.gazeY.toFixed(2) + "px");
  }

  function animationLoop() {
    updateGaze();
    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging || state.danger) return;

    character.dataset.blink = "true";
    clearTimeout(state.blinkTimer);

    const double = Math.random() < 0.09;
    state.blinkTimer = setTimeout(() => {
      character.dataset.blink = "false";

      if (double && state.enabled && !state.sleeping && !state.danger) {
        setTimeout(() => {
          character.dataset.blink = "true";
          setTimeout(() => { character.dataset.blink = "false"; }, 115);
        }, 105);
      }
    }, 135);

    state.nextBlink = now() + rand(6200, 10400);
  }

  function walkingDuration(distance, direction, reason = "wander") {
    if (reason === "evade") {
      return clamp(420 + distance * 0.68, 560, 1120);
    }
    if (direction === "up") return clamp(1750 + distance * 1.95, 2000, 3900);
    if (direction === "down") return clamp(1100 + distance * 0.95, 1200, 2600);
    return clamp(1400 + distance * 1.42, 1550, 3200);
  }

  function visualDirection(dx, dy) {
    if (Math.abs(dy) > Math.abs(dx) * 0.7) return dy < 0 ? "up" : "down";
    return dx < 0 ? "left" : "right";
  }

  function easeInOut(t) {
    const smooth = t * t * (3 - 2 * t);
    return smooth;
  }

  function stopMove() {
    if (state.moveAnimation) cancelAnimationFrame(state.moveAnimation);
    state.moveAnimation = 0;
    state.moveToken += 1;
    character.dataset.moving = "false";
    character.dataset.direction = "idle";
    visual.style.transform = "";
  }

  function animateMoveTo
(targetX, targetY, reason = "wander") {
    if (!state.enabled || state.dragging || reduced || state.sleeping) return;

    stopMove();

    const startX = state.x;
    const startY = state.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.hypot(dx, dy);

    if (distance < 240) return;

    const direction = visualDirection(dx, dy);
    const duration = reason === "evade"
      ? walkingDuration(distance, direction, reason)
      : clamp(walkingDuration(distance, direction, reason) * 1.40, 3200, 6800);
    const started = now();
    const token = state.moveToken;

    character.dataset.moving = "true";
    character.dataset.direction = direction;

    if (reason === "evade") {
      setExpression("angry", 900, true);
    } else if (direction === "up") {
      setExpression("focused", 1150);
    } else if (direction === "down") {
      setExpression("alert", 900);
    } else {
      setExpression(state.eye === "cyan" ? pick(["neutral", "curious", "excited"]) : pick(["neutral", "happy", "curious"]), 1000);
    }

    function frame() {
      if (token !== state.moveToken || state.dragging || !state.enabled) return;

      const elapsed = now() - started;
      const p = clamp(elapsed / duration, 0, 1);
      const e = easeInOut(p);

      setPosition(
        startX + dx * e,
        startY + dy * e
      );

      if (p < 1) {
        state.moveAnimation = requestAnimationFrame(frame);
      } else {
        state.moveAnimation = 0;
        character.dataset.moving = "false";
        character.dataset.direction = "idle";
        visual.style.transform = "";

        if (direction === "down") {
          character.classList.add("is-landed");
          setTimeout(() => character.classList.remove("is-landed"), 500);
        }

        if (reason === "wander") {
          state.lastWander = now();
          state.nextWander = now() + (
            state.context === "study"
              ? rand(13000, 22000)
              : rand(20000, 34000)
          );
        }

        if (reason === "evade") {
          setTimeout(() => { state.evading = false; }, rand(450, 850));
        }
      }
    }

    state.moveAnimation = requestAnimationFrame(frame);
  }

  function randomSafePoint() {
    const marginX = window.innerWidth <= 720 ? 55 : 70;
    const marginTop = 95;
    const marginBottom = 100;

    const x = rand(marginX, Math.max(marginX + 20, window.innerWidth - marginX));
    const y = rand(marginTop, Math.max(marginTop + 25, window.innerHeight - marginBottom));
    return { x, y };
  }

  function visibleDestination() {
    const minDistance = Math.max(300, Math.min(window.innerWidth, window.innerHeight) * 0.34);
    const candidates = [...document.querySelectorAll(
      ".subject-card, .utility-card, .telegram-card, .card, .resource-card, .tool-card"
    )].filter((el) => {
      if (!el || el === launcher || panel.contains(el) || character.contains(el)) return false;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 90 && r.height > 40 &&
        r.bottom > 70 && r.top < window.innerHeight - 30 &&
        style.display !== "none" && style.visibility !== "hidden";
    });

    for (let attempt = 0; attempt < 10; attempt++) {
      const point = candidates.length && Math.random() < 0.30
        ? (() => {
            const el = pick(candidates);
            const r = el.getBoundingClientRect();
            const side = Math.random() < 0.5 ? -1 : 1;
            return {
              x: clamp(r.left + r.width / 2 + side * rand(120, 170), 60, window.innerWidth - 60),
              y: clamp(r.top + r.height / 2 + rand(-100, 100), 105, window.innerHeight - 110)
            };
          })()
        : randomSafePoint();

      if (Math.hypot(point.x - state.x, point.y - state.y) >= minDistance) return point;
    }

    return randomSafePoint();
  }

  function wander() {
    if (!state.enabled || state.sleeping || state.dragging || reduced || state.angerUntil > now()) return;

    const point = visibleDestination();
    animateMoveTo(point.x, point.y, "wander");
  }

  function evadeCursor(force = false) {
    if (!state.enabled || state.dragging || reduced) return;
    if (state.evading && !force) return;
    if (!force && now() < state.nextEvade) return;
    if (state.moveAnimation && !force) return;

    const dx = state.x - state.pointerX;
    const dy = state.y - state.pointerY;
    const len = Math.max(1, Math.hypot(dx, dy));

    let vx = dx / len;
    let vy = dy / len;

    if (len < 1) {
      vx = Math.random() < 0.5 ? -1 : 1;
      vy = Math.random() < 0.5 ? -0.6 : 0.6;
    }

    const distance = state.angerLevel >= 4 ? rand(190, 270) : rand(165, 225);
    let tx = state.x + vx * distance;
    let ty = state.y + vy * distance * 0.78;

    if (Math.abs(vx) < 0.25) tx += (Math.random() < 0.5 ? -1 : 1) * rand(50, 110);

    tx = clamp(tx, 55, window.innerWidth - 55);
    ty = clamp(ty, 92, window.innerHeight - 105);

    setExpression("angry", 900, true);
    state.nextEvade = now() + rand(420, 720);
    state.evading = true;
    animateMoveTo(tx, ty, "evade");
  }

  function enterAnger(level = 1) {
    if (!state.enabled) return;

    state.sleeping = false;
    state.angerLevel = clamp(Math.max(state.angerLevel, level), 1, 5);
    state.angerUntil = now() + rand(4200, 6200);
    state.danger = true;
    character.dataset.danger = "true";
    character.dataset.angerLevel = String(state.angerLevel);
    clearTimeout(state.angerTimer);
    setExpression("angry", 1700, true);
    state.evading = false;
    setGazeTarget(state.pointerX, state.pointerY, true);

    if (state.angerLevel >= 2) {
      showThought(state.angerLevel >= 4 ? "BACK OFF." : "...seriously?", 1100);
    }

    state.angerTimer = setTimeout(() => {
      if (now() >= state.angerUntil) {
        state.danger = false;
        character.dataset.danger = "false";
        character.dataset.angerLevel = "0";
        state.angerLevel = 0;
        state.evading = false;
        if (!state.dragging && !state.sleeping) setExpression("neutral", 800);
      }
    }, 6300);

    evadeCursor(true);
  }

  function handlePetTap() {
    wake("pointer");

    const t = now();
    state.lastMeaningfulActivity = t;
    state.clickTimes = state.clickTimes.filter((item) => t - item < 1200);
    state.clickTimes.push(t);

    const rapid = state.clickTimes.length;
    if (rapid >= 3) {
      enterAnger(Math.min(5, rapid));
    } else if (rapid === 2) {
      setExpression("annoyed", 850, true);
      showThought(state.eye === "cyan" ? "Dude..." : "Seriously?", 900);
    } else {
      setExpression(state.eye === "cyan" ? "curious" : "shy", 700, true);
    }
  }

  function startDrag(ev) {
    if (!state.enabled || state.angerUntil > now() && ev.pointerType === "mouse") {
      if (state.angerUntil > now()) evadeCursor(true);
      return;
    }

    stopMove();
    wake("pointer");

    state.dragging = false;
    state.evading = false;
    state.dragPointerId = ev.pointerId;
    state.dragOffsetX = ev.clientX - state.x;
    state.dragOffsetY = ev.clientY - state.y;
    state.pressX = ev.clientX;
    state.pressY = ev.clientY;
    state.pointerMoved = false;

    character.setPointerCapture?.(ev.pointerId);
  }

  function drag(ev) {
    if (state.dragPointerId !== ev.pointerId) return;

    const travel = Math.hypot(ev.clientX - state.pressX, ev.clientY - state.pressY);

    if (!state.dragging && travel < 7) return;

    if (!state.dragging) {
      state.dragging = true;
      character.classList.add("is-dragging");
      setExpression("scared", 1200, true);
    }

    state.pointerMoved = true;
    setPosition(ev.clientX - state.dragOffsetX, ev.clientY - state.dragOffsetY);
    setGazeTarget(ev.clientX, ev.clientY, false);
    state.lastActivity = now();
  }

  function endDrag(ev) {
    if (ev.pointerId !== state.dragPointerId) return false;

    const wasDragging = state.dragging || state.pointerMoved;
    state.dragging = false;
    state.dragPointerId = null;
    character.classList.remove("is-dragging");
    save(KEY.x, Math.round(state.x));
    save(KEY.y, Math.round(state.y));

    character.releasePointerCapture?.(ev.pointerId);

    state.evading = false;
    state.pointerMoved = false;

    if (wasDragging) {
      setExpression("relieved", 1050, true);
    }

    return wasDragging;
  }

  function nearestInteractive(el) {
    return el?.closest?.(
      ".subject-card, .utility-card, .telegram-card, .card, .resource-card, .tool-card, .tool-panel, button, a, input, select, textarea, .theme-toggle"
    ) || null;
  }

  document.addEventListener("pointermove", (ev) => {
    if (!state.enabled) return;

    state.pointerX = ev.clientX;
    state.pointerY = ev.clientY;
    state.lastActivity = now();

    if (state.dragPointerId === ev.pointerId) {
      drag(ev);
      return;
    }

    if (state.sleeping) wake("pointer");

    if (!state.dragging && state.angerUntil > now()) {
      const distance = Math.hypot(ev.clientX - state.x, ev.clientY - state.y);
      const avoidRadius = state.angerLevel >= 4 ? 235 : 195;
      if (distance < avoidRadius && !state.evading) evadeCursor();
    }

    if (!state.dragging && state.angerUntil <= now() && !state.evading) {
      setGazeTarget(ev.clientX, ev.clientY, false);
    }
  }, { passive: true });

  character.addEventListener("pointerenter", () => {
    if (!state.enabled) return;
    wake("pointer");

    if (state.angerUntil > now()) {
      enterAnger(Math.max(2, state.angerLevel || 2));
      return;
    }

    setExpression(state.eye === "cyan" ? "curious" : "shy", 900);
  });

  character.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    if (state.angerUntil > now()) {
      enterAnger(Math.max(3, state.angerLevel || 3));
      ev.preventDefault();
      return;
    }
    startDrag(ev);
    ev.preventDefault();
  });

  character.addEventListener("pointerup", (ev) => {
    const wasDragging = endDrag(ev);
    if (!wasDragging) handlePetTap();
  });

  character.addEventListener("pointercancel", endDrag);
  character.addEventListener("dblclick", (ev) => {
    ev.preventDefault();
    enterAnger(4);
  });

  character.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      handlePetTap();
    }
  });

  document.addEventListener("pointerover", (ev) => {
    const interactive = nearestInteractive(ev.target);
    if (!interactive || interactive === state.lastHoveredElement) return;
    if (interactive.contains(ev.relatedTarget)) return;

    state.lastHoveredElement = interactive;
    reactToElement(interactive, "hover");
  }, { passive: true });

  document.addEventListener("click", (ev) => {
    if (!state.enabled) return;
    const interactive = nearestInteractive(ev.target);
    if (!interactive || interactive === character || character.contains(interactive)) return;
    reactToElement(interactive, "click");
  }, { passive: true });

  document.addEventListener("input", (ev) => {
    if (!state.enabled) return;
    const el = ev.target;
    const text = descriptor(el);
    const value = String(el.value || "");
    state.lastMeaningfulActivity = now();
    const isName = /name|profile|display name/.test(text);
    if (value) {
      setExpression(isName ? "curious" : "focused", isName ? 850 : 650);
      if (isName && value.length >= 2 && Math.random() < 0.10) showThought("Is that your name?", 1100);
    }
  }, { passive: true });

  document.addEventListener("scroll", () => {
    if (!state.enabled) return;
    state.lastActivity = now();
    state.lastMeaningfulActivity = now();
    if (Math.random() < 0.045 && !state.sleeping) {
      setExpression("alert", 600);
    }
  }, { passive: true });

  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setExpression("surprised", 850);
      showThought("New lighting.", 900);
    });
  }

  launcher.addEventListener("click", () => {
    state.lastMeaningfulActivity = now();
    const open = panel.hidden;
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    if (open) {
      launcher.classList.add("is-open");
      updateControls();
    } else {
      launcher.classList.remove("is-open");
    }
  });

  closeButton.addEventListener("click", () => {
    state.lastMeaningfulActivity = now();
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.classList.remove("is-open");
  });

  enableButton.addEventListener("click", () => {
    state.lastMeaningfulActivity = now();
    setEnabled(true);
  });
  disableButton.addEventListener("click", () => {
    state.lastMeaningfulActivity = now();
    setEnabled(false);
  });

  eyeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.lastMeaningfulActivity = now();
      state.eye = button.dataset.petEye === "pink" ? "pink" : "cyan";
      character.dataset.eye = state.eye;
      save(KEY.eye, state.eye);
      setExpression(state.eye === "cyan" ? "delighted" : "shy", 1000, true);
      showThought(state.eye === "cyan" ? "Heh." : "✨", 900);
      updateControls();
    });
  });

  function updateControls() {
    enableButton.classList.toggle("is-active", state.enabled);
    disableButton.classList.toggle("is-active", !state.enabled);
    eyeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });
  }

  function setEnabled(enabled) {
    state.enabled = enabled;
    save(KEY.enabled, enabled);

    if (!enabled) {
      stopMove();
      state.sleeping = false;
      state.dragging = false;
      state.danger = false;
      state.angerUntil = 0;
      state.angerLevel = 0;
      state.evading = false;
      clearTimeout(state.angerTimer);
      character.dataset.danger = "false";
      character.dataset.angerLevel = "0";
      character.dataset.state = "neutral";
      hideThought();
      stage.classList.add("is-disabled");
      launcher.classList.remove("is-open");
    } else {
      stage.classList.remove("is-disabled");
      setExpression("surprised", 850, true);
      setGazeTarget(state.pointerX, state.pointerY, false);
      state.lastActivity = now();
      state.lastMeaningfulActivity = now();
      state.nextWander = now() + rand(4000, 7500);
      showThought("I'm back.", 950);
    }

    updateControls();
  }

  character.dataset.eye = state.eye;
  stage.classList.toggle("is-disabled", !state.enabled);
  updateControls();

  window.addEventListener("resize", () => {
    setPosition(
      clamp(state.x, 55, window.innerWidth - 55),
      clamp(state.y, 92, window.innerHeight - 105)
    );
  }, { passive: true });

  function idleAndLife() {
    if (!state.enabled || document.hidden || state.dragging) return;

    const t = now();
    const idleFor = t - state.lastMeaningfulActivity;

    if (idleFor >= 32000 && !state.sleeping && state.angerUntil <= t) {
      state.sleeping = true;
      state.expression = "sleeping";
      character.dataset.state = "sleeping";
      character.dataset.blink = "false";
      hideThought();
      stopMove();
      return;
    }

    if (state.sleeping) return;

    if (t >= state.nextBlink) blink();

    if (t >= state.nextWander && state.angerUntil <= t && idleFor >= 2600) wander();

    if (t >= state.nextAmbient && state.angerUntil <= t) {
      state.nextAmbient = t + (
        state.context === "study"
          ? rand(9500, 16500)
          : rand(13000, 23000)
      );

      const base = pick(contextMoods[state.context] || ["neutral"]);
      const expression = personaVariation(base);
      setExpression(expression, rand(800, 1500));
    }

    if (state.angerUntil > t) {
      const distance = Math.hypot(state.pointerX - state.x, state.pointerY - state.y);
      const avoidRadius = state.angerLevel >= 4 ? 235 : 195;
      if (distance < avoidRadius && !state.evading) evadeCursor();
    } else if (state.angerUntil <= t && state.danger) {
      state.danger = false;
      character.dataset.danger = "false";
    }
  }

  setInterval(idleAndLife, 400);
  setTimeout(() => setExpression("curious", 950, true), 850);
})();