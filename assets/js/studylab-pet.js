/* =========================================================
   StudyLab Living Pet — PR30
   Built on the PR #21 final StudyLab baseline.
   Page-level only. No simulation integration.
   ========================================================= */

(function () {
  "use strict";

  if (window.__StudyLabLivingPetPR30) return;
  window.__StudyLabLivingPetPR30 = true;

  const KEY = {
    enabled: "studylab-pet-enabled",
    eye: "studylab-pet-eye",
    bubble: "studylab-pet-bubble",
    x: "studylab-pet-x",
    y: "studylab-pet-y"
  };

  const reducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const now = () => Date.now();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => min + Math.random() * (max - min);
  const pick = (items) => items[Math.floor(Math.random() * items.length)];

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function readBool(key, fallback) {
    return read(key, String(fallback)) === "true";
  }

  const state = {
    enabled: readBool(KEY.enabled, true),
    eye: read(KEY.eye, "cyan") === "pink" ? "pink" : "cyan",
    bubbleEnabled: readBool(KEY.bubble, true),

    x: Number(read(KEY.x, Math.round(window.innerWidth * 0.72))) || window.innerWidth * 0.72,
    y: Number(read(KEY.y, Math.round(window.innerHeight * 0.53))) || window.innerHeight * 0.53,

    velocityX: 0,
    velocityY: 0,
    targetX: 0,
    targetY: 0,
    moving: false,
    nextMoveAt: now() + random(9000, 15000),
    pauseUntil: 0,
    lastFrame: performance.now(),

    gazeX: 0,
    gazeY: 0,
    gazeTargetX: 0,
    gazeTargetY: 0,
    pointerX: window.innerWidth * 0.72,
    pointerY: window.innerHeight * 0.52,

    sleeping: false,
    sleepStartedAt: 0,
    lastActivity: now(),
    nextBlink: now() + random(5200, 9000),

    angerLevel: 0,
    angerUntil: 0,
    angerTimer: null,
    clickTimes: [],

    fadeTimer: null,
    thoughtTimer: null,
    expressionTimer: null,
    enableAnimationFrame: 0,
    enableAnimationToken: 0,

    dragging: false,
    pointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    pressX: 0,
    pressY: 0,
    pointerMoved: false,

    lastPointerX: window.innerWidth * 0.72,
    lastPointerY: window.innerHeight * 0.52,
    nextSleepAt: now() + random(7000, 10000),
    hoverTimer: null,
    hoverTarget: null,
    lastContextAt: 0
  };

  function profile() {
    return state.eye === "cyan"
      ? {
          speed: 64,
          acceleration: 5.2,
          arriveRadius: 13,
          waitMin: 8500,
          waitMax: 15000,
          activeChance: .36,
           gazeScaleX: 1.08,
           gazeScaleY: 0.98,
           gazeSmoothing: 0.17,
           blinkMin: 5600,
           blinkMax: 9200,
           idleExpressions: ["neutral", "curious", "focused", "alert"],
           tapExpressions: ["curious", "alert", "focused"],
           arriveExpressions: ["delighted", "happy", "focused", "alert"],
          thoughts: ["I'm watching.", "Let's move.", "Easy.", "Keeping an eye on things."]
        }
      : {
          speed: 54,
          acceleration: 4.2,
          arriveRadius: 12,
          waitMin: 10000,
          waitMax: 17500,
          activeChance: .28,
           gazeScaleX: 0.88,
           gazeScaleY: 0.90,
           gazeSmoothing: 0.12,
           blinkMin: 6500,
           blinkMax: 10800,
           idleExpressions: ["neutral", "curious", "happy", "shy"],
           tapExpressions: ["curious", "shy", "happy"],
           arriveExpressions: ["happy", "delighted", "shy", "curious"],
          thoughts: ["I'm here.", "Let's see.", "Hi.", "Still watching."]
        };
  }

  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = document.currentScript
    ? new URL("../css/studylab-pet.css", document.currentScript.src).href
    : new URL("assets/css/studylab-pet.css", document.baseURI).href;
  document.head.appendChild(styleLink);

  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="studylabPetStage">' +
      '<div class="sl-pet-character" role="button" tabindex="0" aria-label="StudyLab Pet" ' +
        'data-state="neutral" data-eye="cyan" data-danger="false" data-blink="false" data-moving="false" data-enable="false">' +
        '<div class="sl-pet-visual">' +
          '<div class="sl-pet-face" aria-hidden="true">' +
            '<div class="sl-pet-eye left"><i></i></div>' +
            '<div class="sl-pet-eye right"><i></i></div>' +
            '<div class="sl-pet-mouth"></div>' +
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
      '<div class="sl-pet-setting"><span>Message box</span><div class="sl-pet-setting-buttons">' +
        '<button type="button" data-pet-bubble-enable>Enable</button><button type="button" data-pet-bubble-disable>Disable</button>' +
      '</div></div>' +
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
  const bubbleEnableButton = panel.querySelector("[data-pet-bubble-enable]");
  const bubbleDisableButton = panel.querySelector("[data-pet-bubble-disable]");

  function syncLoadingVisibility() {
    const loader = document.getElementById("studylabLoader");
    const loading = Boolean(loader && !loader.classList.contains("is-exiting"));

    stage.classList.toggle("is-site-loading-hidden", loading);
    launcher.classList.toggle("is-site-loading-hidden", loading);

    if (loading) {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      launcher.classList.remove("is-open");
    }
  }

  syncLoadingVisibility();

  let loadingPollTimer = null;
  if (document.getElementById("studylabLoader")) {
    loadingPollTimer = window.setInterval(() => {
      syncLoadingVisibility();

      if (!document.getElementById("studylabLoader")) {
        window.clearInterval(loadingPollTimer);
        loadingPollTimer = null;
      }
    }, 100);
  }

  const expressions = [
    "neutral", "curious", "happy", "focused", "alert", "thinking",
    "worried", "confused", "bored", "sleeping", "relieved",
    "angry", "scared", "annoyed", "delighted", "surprised", "shy"
  ];

  function safeX() {
    return window.innerWidth <= 720 ? 41 : 45;
  }

  function safeY() {
    return {
      min: 74,
      max: Math.max(94, window.innerHeight - 82)
    };
  }

  function setPosition(x, y) {
    const half = safeX();
    const bounds = safeY();

    state.x = clamp(x, half, window.innerWidth - half);
    state.y = clamp(y, bounds.min, bounds.max);

    character.style.transform =
      "translate3d(" + state.x + "px, " + state.y + "px, 0) translate(-50%, -50%)";

    if (thought.classList.contains("is-visible")) {
      positionThought();
    }
  }

  function positionThought() {
    const width = window.innerWidth <= 720 ? 98 : 108;
    thought.style.left = clamp(
      state.x - width * 0.52 + 7,
      8,
      Math.max(8, window.innerWidth - width - 8)
    ) + "px";
    thought.style.top = Math.max(54, state.y - 40) + "px";
  }

  function savePosition() {
    save(KEY.x, Math.round(state.x));
    save(KEY.y, Math.round(state.y));
  }

  window.addEventListener("pagehide", savePosition);
  window.addEventListener("beforeunload", savePosition);

  function setExpression(name, duration = 900, force = false) {
    if (!state.enabled && !force) return;

    const next = expressions.includes(name) ? name : "neutral";
    character.dataset.state = state.sleeping ? "sleeping" : next;

    clearTimeout(state.expressionTimer);

    if (duration > 0) {
      state.expressionTimer = setTimeout(() => {
        if (!state.enabled || state.sleeping || state.dragging || state.angerUntil > now()) return;
        character.dataset.state = "neutral";
      }, duration);
    }
  }

  function showThought(message, duration = 1400, force = false) {
    if (!state.enabled || (!state.bubbleEnabled && !force) || !message) return;

    thoughtText.textContent = message;
    positionThought();
    thought.classList.add("is-visible");

    clearTimeout(state.thoughtTimer);
    state.thoughtTimer = setTimeout(() => thought.classList.remove("is-visible"), duration);
  }

  function hideThought() {
    clearTimeout(state.thoughtTimer);
    thought.classList.remove("is-visible");
  }

  function setGazeTarget(x, y, immediate = false) {
    if (state.angerUntil > now()) return;

    const dx = x - state.x;
    const dy = y - state.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const scale = clamp(distance / 170, 0.45, 1);

    const gx = clamp(dx / 130, -1, 1) * 6.5 * scale;
    const gy = clamp(dy / 110, -1, 1) * 5.8 * scale;

    const p = profile();
    state.gazeTargetX = clamp(gx * (p.gazeScaleX || 1), -7.2, 7.2);
    state.gazeTargetY = clamp(gy * (p.gazeScaleY || 1), -6.2, 6.2);

    if (immediate) {
      state.gazeX = state.gazeTargetX;
      state.gazeY = state.gazeTargetY;
    }
  }

  function updateGaze() {
    if (
      state.enabled &&
      !state.dragging &&
      !state.sleeping &&
      state.angerUntil <= now() &&
      !state.enableAnimationFrame
    ) {
      setGazeTarget(state.pointerX, state.pointerY);
    }

    const p = profile();
    const smoothing = p.gazeSmoothing || 0.14;
    state.gazeX += (state.gazeTargetX - state.gazeX) * smoothing;
    state.gazeY += (state.gazeTargetY - state.gazeY) * smoothing;

    eyes.forEach((eye) => {
      eye.style.setProperty("--gaze-x", state.gazeX.toFixed(2) + "px");
      eye.style.setProperty("--gaze-y", state.gazeY.toFixed(2) + "px");
    });
  }

  function chooseTarget() {
    const half = safeX();
    const bounds = safeY();
    const marginX = half + 24;
    const marginY = bounds.min + 12;

    state.targetX = random(
      marginX,
      Math.max(marginX + 25, window.innerWidth - marginX)
    );
    state.targetY = random(
      marginY,
      Math.max(marginY + 25, bounds.max - 10)
    );
  }

  function startNormalMove() {
    if (
      !state.enabled ||
      state.sleeping ||
      state.dragging ||
      state.enableAnimationFrame ||
      state.angerUntil > now() ||
      reducedMotion
    ) {
      return;
    }

    chooseTarget();
    state.moving = true;
    state.pauseUntil = 0;
    character.dataset.moving = "true";
    setExpression(pick(profile().arriveExpressions), 650);
  }

  function stopNormalMove() {
    state.moving = false;
    state.velocityX = 0;
    state.velocityY = 0;
    character.dataset.moving = "false";
    character.dataset.direction = "idle";
  }

  function updateNormalMove(timestamp) {
    const p = profile();

    if (
      !state.enabled ||
      state.sleeping ||
      state.dragging ||
      state.enableAnimationFrame ||
      state.angerUntil > now() ||
      reducedMotion
    ) {
      state.lastFrame = timestamp;
      return;
    }

    const dt = clamp((timestamp - state.lastFrame) / 1000, 0.001, 0.04);
    state.lastFrame = timestamp;

    if (!state.moving) {
      if (now() >= state.nextMoveAt) {
        if (Math.random() < p.activeChance) {
          startNormalMove();
        } else {
          state.nextMoveAt = now() + random(p.waitMin, p.waitMax);
        }
      }
      return;
    }

    const dx = state.targetX - state.x;
    const dy = state.targetY - state.y;
    const distance = Math.max(1, Math.hypot(dx, dy));

    if (distance <= p.arriveRadius && Math.hypot(state.velocityX, state.velocityY) < 16) {
      stopNormalMove();
      state.pauseUntil = now() + random(450, 900);
      state.nextMoveAt = state.pauseUntil + random(p.waitMin, p.waitMax);
      setExpression(pick(p.arriveExpressions), 850);
      return;
    }

    const dirX = dx / distance;
    const dirY = dy / distance;

    let targetSpeed = p.speed;
    if (distance < 180) targetSpeed *= clamp(distance / 180, 0.18, 1);
    if (distance < 70) targetSpeed *= clamp(distance / 70, 0.16, 1);

    const desiredX = dirX * targetSpeed;
    const desiredY = dirY * targetSpeed;

    const response = 1 - Math.exp(-p.acceleration * dt);
    state.velocityX += (desiredX - state.velocityX) * response;
    state.velocityY += (desiredY - state.velocityY) * response;

    const speed = Math.hypot(state.velocityX, state.velocityY);
    if (speed > p.speed) {
      const scale = p.speed / speed;
      state.velocityX *= scale;
      state.velocityY *= scale;
    }

    setPosition(
      state.x + state.velocityX * dt,
      state.y + state.velocityY * dt
    );

    character.dataset.moving = speed > 4 ? "true" : "false";
    character.dataset.direction =
      speed > 4
        ? (Math.abs(state.velocityY) > Math.abs(state.velocityX) * 0.7
          ? (state.velocityY < 0 ? "up" : "down")
          : (state.velocityX < 0 ? "left" : "right"))
        : "idle";
  }

  function cancelEnableAnimation() {
    if (state.enableAnimationFrame) {
      cancelAnimationFrame(state.enableAnimationFrame);
      state.enableAnimationFrame = 0;
    }
    state.enableAnimationToken += 1;
    character.dataset.enable = "false";
  }

  function runEnableCircles(done) {
    if (reducedMotion) {
      done?.();
      return;
    }

    cancelEnableAnimation();

    const startX = state.x;
    const startY = state.y;
    const horizontalRoom = Math.min(
      startX - safeX(),
      window.innerWidth - safeX() - startX
    );
    const verticalRoom = Math.min(
      startY - safeY().min,
      safeY().max - startY
    );
    const room = Math.max(12, Math.min(horizontalRoom, verticalRoom));
    const radius = Math.min(52, room);
    const started = performance.now();
    const duration = 900;
    const token = ++state.enableAnimationToken;

    character.dataset.enable = "true";
    character.dataset.state = "happy";
    state.gazeTargetX = 0;
    state.gazeTargetY = 0;

    const frame = (timestamp) => {
      if (
        token !== state.enableAnimationToken ||
        !state.enabled ||
        state.dragging
      ) {
        return;
      }

      const progress = clamp((timestamp - started) / duration, 0, 1);
      const angle = progress * Math.PI * 4;
      setPosition(
        startX + Math.cos(angle) * radius,
        startY + Math.sin(angle) * radius
      );

      if (progress < 1) {
        state.enableAnimationFrame = requestAnimationFrame(frame);
        return;
      }

      state.enableAnimationFrame = 0;
      character.dataset.enable = "false";
      setPosition(startX, startY);
      setExpression("delighted", 1000, true);

      done?.();
    };

    state.enableAnimationFrame = requestAnimationFrame(frame);
  }

  function enablePet() {
    if (state.enabled) {
      updateControls();
      return;
    }

    clearTimeout(state.fadeTimer);
    clearTimeout(state.angerTimer);

    state.enabled = true;
    state.sleeping = false;
    state.angerLevel = 0;
    state.angerUntil = 0;
    state.lastActivity = now();
    state.nextBlink = now() + random(2500, 5000);
    state.nextMoveAt = now() + random(5000, 9000);

    save(KEY.enabled, true);

    stage.classList.remove("is-disabled");
    character.classList.remove("is-fading-out");
    character.style.pointerEvents = "auto";
    character.dataset.danger = "false";
    character.dataset.eye = state.eye;

    hideThought();
    updateControls();

    runEnableCircles(() => {
      state.moving = false;
      state.velocityX = 0;
      state.velocityY = 0;
      state.nextMoveAt = now() + random(profile().waitMin, profile().waitMax);
    });
  }

  function stopAngerEvade() {
    state.angerVelocityX = 0;
    state.angerVelocityY = 0;
    state.nextEvadeAt = 0;
    character.dataset.moving = "false";
    character.dataset.direction = "idle";
  }

  function chooseAngerEvadeTarget() {
    const dx = state.x - state.pointerX;
    const dy = state.y - state.pointerY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    let angle = Math.atan2(dy, dx);

    if (!Number.isFinite(angle) || distance < 24) {
      angle = Math.random() * Math.PI * 2;
    }

    angle += (Math.random() < 0.5 ? -1 : 1) * random(0.18, 0.42);

    const preferred = random(215, 280);
    const half = safeX();
    const bounds = safeY();

    state.evadeTargetX = clamp(state.x + Math.cos(angle) * preferred, half + 12, window.innerWidth - half - 12);
    state.evadeTargetY = clamp(state.y + Math.sin(angle) * preferred * 0.82, bounds.min + 10, bounds.max - 10);
    state.nextEvadeAt = now() + 300;
    character.dataset.moving = "true";
    character.dataset.direction = visualDirection(state.evadeTargetX - state.x, state.evadeTargetY - state.y);
    setExpression("angry", 900, true);
  }

  function updateAngerEvade(timestamp) {
    if (!state.enabled || state.dragging || state.sleeping || state.angerUntil <= now()) {
      stopAngerEvade();
      return;
    }

    if (reducedMotion) {
      state.angerVelocityX = 0;
      state.angerVelocityY = 0;
      return;
    }

    const dt = clamp((timestamp - state.lastFrame) / 1000, 0.001, 0.04);
    state.lastFrame = timestamp;

    const distanceFromCursor = Math.hypot(state.x - state.pointerX, state.y - state.pointerY);
    const distanceToTarget = Math.hypot(state.evadeTargetX - state.x, state.evadeTargetY - state.y);

    if (!Number.isFinite(state.evadeTargetX) || !Number.isFinite(state.evadeTargetY) || now() >= state.nextEvadeAt || distanceToTarget < 24 || distanceFromCursor < 165) {
      chooseAngerEvadeTarget();
    }

    const dx = state.evadeTargetX - state.x;
    const dy = state.evadeTargetY - state.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const maxSpeed = state.eye === "cyan" ? 190 : 170;
    const acceleration = state.eye === "cyan" ? 10.5 : 8.6;
    const response = 1 - Math.exp(-acceleration * dt);

    state.angerVelocityX += (dirX * maxSpeed - state.angerVelocityX) * response;
    state.angerVelocityY += (dirY * maxSpeed - state.angerVelocityY) * response;

    const speed = Math.hypot(state.angerVelocityX, state.angerVelocityY);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      state.angerVelocityX *= scale;
      state.angerVelocityY *= scale;
    }

    setPosition(state.x + state.angerVelocityX * dt, state.y + state.angerVelocityY * dt);
  }

  function disablePet() {
    if (!state.enabled) {
      updateControls();
      return;
    }

    state.enabled = false;
    state.sleeping = false;
    state.dragging = false;
    state.angerLevel = 0;
    state.angerUntil = 0;
    stopAngerEvade();
    clearTimeout(state.angerTimer);
    cancelEnableAnimation();
    stopNormalMove();
    hideThought();

    save(KEY.enabled, false);
    savePosition();

    character.dataset.danger = "false";
    character.dataset.moving = "false";
    character.dataset.direction = "idle";
    character.dataset.state = "sad";
    character.classList.add("is-fading-out");
    character.style.pointerEvents = "none";

    state.fadeTimer = setTimeout(() => {
      if (!state.enabled) stage.classList.add("is-disabled");
    }, 1300);

    updateControls();
  }

  function enterAnger(level = 3) {
    if (!state.enabled) return;

    state.sleeping = false;
    state.angerLevel = clamp(level, 3, 5);
    state.angerUntil = now() + random(3900, 5100);
    state.angerVelocityX = 0;
    state.angerVelocityY = 0;
    state.evadeTargetX = state.x;
    state.evadeTargetY = state.y;
    state.nextEvadeAt = 0;

    stopNormalMove();

    character.dataset.danger = "true";
    character.dataset.state = "angry";

    state.gazeTargetX = 0;
    state.gazeTargetY = 0;
    state.gazeX = 0;
    state.gazeY = 0;
    chooseAngerEvadeTarget();
    showThought("Stop poking me.", 1100);

    clearTimeout(state.angerTimer);
    state.angerTimer = setTimeout(() => {
      state.angerLevel = 0;
      state.angerUntil = 0;
      character.dataset.danger = "false";
      stopAngerEvade();
      state.lastActivity = now();
      state.nextMoveAt = now() + random(7000, 11000);
      setExpression(pick(profile().idleExpressions), 950);
      setGazeTarget(state.pointerX, state.pointerY);
    }, 5100);
  }

  function registerTap() {
    if (!state.enabled) return;

    const time = now();
    state.lastActivity = time;
    state.clickTimes = state.clickTimes.filter(
      (stamp) => time - stamp < 1500
    );
    state.clickTimes.push(time);

    if (state.clickTimes.length >= 3) {
      state.clickTimes = [];
      enterAnger(5);
      return;
    }

    setExpression(pick(profile().tapExpressions), 800);
    if (state.bubbleEnabled) {
      showThought(
        state.eye === "cyan"
          ? pick(["Hm?", "You called?", "I'm here."])
          : pick(["Hm?", "Hi.", "You called?"]),
        850
      );
    }
  }

  function wake() {
    if (!state.sleeping) {
      state.nextSleepAt = now() + random(7000, 10000);
      return;
    }

    state.sleeping = false;
    state.lastActivity = now();
    state.nextSleepAt = now() + random(7000, 10000);
    state.nextBlink = now() + random(2400, 4800);
    setExpression("curious", 850, true);

    if (state.bubbleEnabled) showThought("I'm awake.", 900);
    state.nextMoveAt = now() + random(5000, 9000);
  }

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging || state.enableAnimationFrame) return;

    character.dataset.blink = "true";
    setTimeout(() => {
      if (state.enabled) character.dataset.blink = "false";
    }, 135);
  }

  function updateControls() {
    enableButton.classList.toggle("is-active", state.enabled);
    disableButton.classList.toggle("is-active", !state.enabled);
    eyeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });
    bubbleEnableButton.classList.toggle("is-active", state.bubbleEnabled);
    bubbleDisableButton.classList.toggle("is-active", !state.bubbleEnabled);
  }

  function startDrag(event) {
    if (!state.enabled || state.angerUntil > now() || state.enableAnimationFrame) return;

    stopNormalMove();

    state.pointerId = event.pointerId;
    state.dragOffsetX = event.clientX - state.x;
    state.dragOffsetY = event.clientY - state.y;
    state.pressX = event.clientX;
    state.pressY = event.clientY;
    state.pointerMoved = false;
    state.dragging = false;

    character.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (event.pointerId !== state.pointerId) return;

    const travel = Math.hypot(
      event.clientX - state.pressX,
      event.clientY - state.pressY
    );

    if (!state.dragging && travel < 7) return;

    if (!state.dragging) {
      state.dragging = true;
      character.classList.add("is-dragging");
      setExpression("scared", 950, true);
    }

    state.pointerMoved = true;
    setPosition(
      event.clientX - state.dragOffsetX,
      event.clientY - state.dragOffsetY
    );
    setGazeTarget(event.clientX, event.clientY);
    state.lastActivity = now();
  }

  function endDrag(event) {
    if (event.pointerId !== state.pointerId) return false;

    const dragged = state.dragging || state.pointerMoved;

    state.dragging = false;
    state.pointerId = null;
    state.pointerMoved = false;
    character.classList.remove("is-dragging");

    character.releasePointerCapture?.(event.pointerId);

    save(KEY.x, Math.round(state.x));
    save(KEY.y, Math.round(state.y));

    if (!dragged) registerTap();

    if (dragged && state.enabled && state.angerUntil <= now()) {
      setExpression("relieved", 850, true);
      state.nextMoveAt = now() + random(5000, 9000);
    }

    return dragged;
  }

  function nearestInteractiveTarget(element) {
    return element?.closest?.(
      "a, button, input, select, textarea, " +
      ".subject-card, .tool-card, .utility-card, .telegram-card, " +
      ".examhub-card, .resource-card, .study-tools-card, .card"
    ) || null;
  }

  function contextText(target) {
    if (!target) return "";
    const container =
      target.closest?.(
        ".subject-card, .tool-card, .utility-card, .telegram-card, " +
        ".examhub-card, .resource-card, .study-tools-card, .card"
      ) || target;

    const heading =
      container.querySelector?.("h1,h2,h3,h4,h5,h6,strong")?.textContent || "";

    return [
      target.innerText || "",
      target.getAttribute?.("aria-label") || "",
      target.getAttribute?.("title") || "",
      heading,
      container.innerText || "",
      target.getAttribute?.("href") || ""
    ].join(" ").replace(/\s+/g, " ").trim().slice(0, 600);
  }

  function contextMessage(target) {
    const text = contextText(target).toLowerCase();
    const label =
      (target?.innerText || target?.getAttribute?.("aria-label") ||
        target?.getAttribute?.("title") || "").replace(/\s+/g, " ").trim();

    let topic = "";
    if (/combined\s*math|maths|mathematics|trigonometry|calculus|algebra|quadratic|differentiation|integration|vectors?|probability|binomial|straight.?line|series/.test(text)) {
      topic = "Maths";
    } else if (/physics|doppler|gravity|wave|oscillation|force|motion|electricity|optics|heat|pressure|mechanics|spectrometer|resonance|sonometer|pendulum/.test(text)) {
      topic = "Physics";
    } else if (/chemistry|chemical|practical|laboratory|reaction|titration|cation|anion|organic|inorganic|energetics|equilibrium|kinetics/.test(text)) {
      topic = "Chemistry";
    } else if (/biology|genetics|cell|ecology|organism|digestive|nervous|reproductive|circulatory|endocrine|osmoregulation/.test(text)) {
      topic = "Biology";
    } else if (/general\s*english|english/.test(text)) {
      topic = "General English";
    } else if (/\bgit\b|information\s*&?\s*communication|ict/.test(text)) {
      topic = "GIT";
    } else if (/exam|past\s*paper|marking\s*scheme|school\s*paper|model\s*paper|timetable|evaluation/.test(text)) {
      topic = "Exam";
    } else if (/study\s*tool|pomodoro|flashcard|calculator|planner|focus/.test(text)) {
      topic = "Study Tools";
    } else if (/telegram|channel|community/.test(text)) {
      topic = "Telegram";
    } else if (/audio|book|listen/.test(text)) {
      topic = "Audio";
    }

    const safeLabel = label ? label.slice(0, 70) : "";

    if (topic === "Maths") return safeLabel ? "Maths: ready for " + safeLabel + "." : "Maths time. Keep those steps sharp.";
    if (topic === "Physics") return safeLabel ? "Physics: " + safeLabel + " is ready to explore." : "Physics: watch how the variables move.";
    if (topic === "Chemistry") return safeLabel ? "Chemistry: " + safeLabel + " is on the bench." : "Chemistry time. Watch the reaction.";
    if (topic === "Biology") return safeLabel ? "Biology: " + safeLabel + " is ready." : "Biology: look closely at the system.";
    if (topic === "General English") return safeLabel ? "English: " + safeLabel + "." : "English time. Keep the meaning clear.";
    if (topic === "GIT") return safeLabel ? "GIT: " + safeLabel + "." : "GIT: time to check the details.";
    if (topic === "Exam") return safeLabel ? "Exam mode: " + safeLabel + "." : "Exam resources. Keep checking carefully.";
    if (topic === "Study Tools") return safeLabel ? "Study Tools: " + safeLabel + "." : "Study Tools are ready.";
    if (topic === "Telegram") return safeLabel ? "Telegram: " + safeLabel + "." : "Study resources are waiting there.";
    if (topic === "Audio") return safeLabel ? "Audio: " + safeLabel + "." : "Audio time. Give your ears some work.";

    return safeLabel ? "Ready to open " + safeLabel + "." : "Something interesting is here.";
  }

  function trackContextHover(target) {
    if (!state.enabled || state.sleeping || state.angerUntil > now()) return;

    if (target === state.hoverTarget) return;

    clearTimeout(state.hoverTimer);
    state.hoverTarget = target;

    if (!target || target === character || character.contains(target) ||
        target === launcher || panel.contains(target)) {
      return;
    }

    state.hoverTimer = setTimeout(() => {
      if (
        target !== state.hoverTarget ||
        !state.enabled ||
        state.sleeping ||
        state.angerUntil > now()
      ) return;

      const currentTime = now();
      if (currentTime - state.lastContextAt < 900) return;

      state.lastContextAt = currentTime;
      showThought(contextMessage(target), 1550);
    }, 560);
  }

  enableButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    enablePet();
  });

  disableButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    disablePet();
  });

  eyeButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.eye = button.dataset.petEye === "pink" ? "pink" : "cyan";
      character.dataset.eye = state.eye;
      save(KEY.eye, state.eye);
      clearTimeout(state.expressionTimer);
      setExpression(
        state.eye === "pink"
          ? pick(["shy", "happy", "curious"])
          : pick(["focused", "alert", "curious"]),
        1500,
        true
      );
      const p = profile();
      state.nextBlink = now() + random(p.blinkMin, p.blinkMax);
      setGazeTarget(state.pointerX, state.pointerY, true);
      updateControls();
    });
  });

  bubbleEnableButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.bubbleEnabled = true;
    save(KEY.bubble, true);
    updateControls();
    showThought("Message box enabled.", 1000, true);
  });

  bubbleDisableButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.bubbleEnabled = false;
    save(KEY.bubble, false);
    hideThought();
    updateControls();
  });

  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.classList.remove("is-open");
  });

  launcher.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const opening = panel.hidden;
    panel.hidden = !opening;
    launcher.setAttribute("aria-expanded", String(opening));
    launcher.classList.toggle("is-open", opening);

    if (opening) updateControls();
  });

  character.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    startDrag(event);
    event.preventDefault();
  });

  character.addEventListener("pointermove", moveDrag);

  character.addEventListener("pointerup", (event) => {
    endDrag(event);
  });

  character.addEventListener("pointercancel", endDrag);

  character.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    registerTap();
  });

  document.addEventListener("pointermove", (event) => {
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;

    const pointerDistance = Math.hypot(
      event.clientX - state.lastPointerX,
      event.clientY - state.lastPointerY
    );

    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;

    if (state.pointerId === event.pointerId) {
      moveDrag(event);
      return;
    }

    if (pointerDistance >= 2) {
      state.lastActivity = now();
      state.nextSleepAt = now() + random(7000, 10000);
    }

    if (state.enabled && !state.dragging && state.angerUntil <= now() && !state.enableAnimationFrame) {
      setGazeTarget(event.clientX, event.clientY);
      trackContextHover(nearestInteractiveTarget(event.target));
    }

    if (state.sleeping && pointerDistance >= 2) wake();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.enabled && state.sleeping) wake();
  });

  window.addEventListener("resize", () => {
    setPosition(
      clamp(state.x, safeX(), window.innerWidth - safeX()),
      clamp(state.y, safeY().min, safeY().max)
    );
  }, { passive: true });

  function lifeLoop(timestamp) {
    updateGaze();
    updateNormalMove(timestamp);

    if (!state.enabled || document.hidden || state.dragging) {
      requestAnimationFrame(lifeLoop);
      return;
    }

    const time = now();

    if (state.angerUntil > time) {
      state.gazeTargetX = 0;
      state.gazeTargetY = 0;
      updateAngerEvade(timestamp);
    } else if (state.angerUntil <= time && state.angerLevel > 0) {
      state.angerLevel = 0;
      state.angerUntil = 0;
      character.dataset.danger = "false";
      stopAngerEvade();
      setGazeTarget(state.pointerX, state.pointerY);
    }

    if (!state.sleeping && time >= state.nextBlink) {
      const p = profile();
      state.nextBlink = time + random(p.blinkMin || 6000, p.blinkMax || 10400);
      blink();
    }

    if (
      !state.sleeping &&
      state.bubbleEnabled &&
      Math.random() < 0.00035
    ) {
      showThought(pick(profile().thoughts), 1300);
    }

    if (
      !state.sleeping &&
      time >= state.nextSleepAt &&
      !state.moving &&
      state.angerUntil <= time &&
      !state.enableAnimationFrame
    ) {
      state.sleeping = true;
      state.sleepStartedAt = time;
      stopNormalMove();
      character.dataset.state = "sleeping";
      hideThought();
    }

    requestAnimationFrame(lifeLoop);
  }

  character.dataset.eye = state.eye;
  setPosition(state.x, state.y);
  state.nextSleepAt = now() + random(7000, 10000);
  updateControls();

  if (!state.enabled) {
    stage.classList.add("is-disabled");
    character.style.pointerEvents = "none";
    character.dataset.state = "sad";
  } else {
    stage.classList.remove("is-disabled");
    character.style.pointerEvents = "auto";
    setExpression(pick(profile().idleExpressions), 850, true);
  }

  requestAnimationFrame(lifeLoop);
})();
