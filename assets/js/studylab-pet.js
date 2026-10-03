/* =========================================================
   StudyLab Living Pet — clean companion engine
   Page-level only. No simulation integration.
   ========================================================= */

(function () {
  "use strict";

  if (window.__StudyLabLivingPetClean) return;
  window.__StudyLabLivingPetClean = true;

  const KEY = {
    enabled: "studylab-pet-enabled",
    eye: "studylab-pet-eye",
    bubble: "studylab-pet-bubble",
    x: "studylab-pet-x",
    y: "studylab-pet-y"
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    targetX: 0,
    targetY: 0,
    velocityX: 0,
    velocityY: 0,
    roamActive: false,
    roamPauseUntil: 0,
    roamLastFrame: performance.now(),
    moveAnimation: 0,
    moveToken: 0,

    burstActive: false,
    burstTimers: [],
    burstToken: 0,

    dragging: false,
    pointerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    pressX: 0,
    pressY: 0,
    pointerMoved: false,

    pointerX: window.innerWidth * 0.72,
    pointerY: window.innerHeight * 0.52,
    gazeX: 0,
    gazeY: 0,
    gazeTargetX: 0,
    gazeTargetY: 0,

    sleeping: false,
    angerLevel: 0,
    angerUntil: 0,
    angerTimer: null,

    clickTimes: [],
    lastMeaningfulActivity: now(),
    lastInteraction: now(),
    lastBlink: now(),
    nextBlink: now() + random(5500, 9500),
    nextThought: now() + random(11000, 19000),
    sleepStartedAt: 0,

    bubbleTimer: null,
    expressionTimer: null,
    hoverTimer: null,
    lastHover: null
  };

  function safeX() {
    return window.innerWidth <= 720 ? 42 : 48;
  }

  function safeY() {
    return {
      min: 76,
      max: Math.max(96, window.innerHeight - 84)
    };
  }

  state.x = clamp(state.x, safeX(), window.innerWidth - safeX());
  {
    const bounds = safeY();
    state.y = clamp(state.y, bounds.min, bounds.max);
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="studylabPetStage">' +
      '<div class="sl-pet-character" role="button" tabindex="0" aria-label="StudyLab Pet" data-state="neutral" data-eye="cyan" data-moving="false" data-direction="idle" data-danger="false" data-burst="false">' +
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
        '<button type="button" data-pet-enable>Enable</button>' +
        '<button type="button" data-pet-disable>Disable</button>' +
      '</div></div>' +
      '<div class="sl-pet-setting"><span>Eye colour</span><div class="sl-pet-setting-buttons">' +
        '<button type="button" data-pet-eye="cyan">Cyan</button>' +
        '<button type="button" data-pet-eye="pink">Pink</button>' +
      '</div></div>' +
      '<div class="sl-pet-setting"><span>Message box</span><div class="sl-pet-setting-buttons">' +
        '<button type="button" data-pet-bubble-enable>Enable</button>' +
        '<button type="button" data-pet-bubble-disable>Disable</button>' +
      '</div></div>' +
      '<p class="sl-pet-panel-note">Enable gives the Pet one quick movement burst, then normal roaming resumes.</p>' +
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

  const expressionNames = [
    "neutral", "curious", "happy", "thinking", "focused",
    "alert", "surprised", "shy", "delighted", "annoyed",
    "angry", "scared", "sleeping", "relieved", "sad"
  ];

  const thoughts = [
    "Still here.",
    "Let's keep going.",
    "Watching the page.",
    "One thing at a time.",
    "Study mode.",
    "Keeping an eye on things."
  ];

  function setPosition(x, y) {
    const half = safeX();
    const bounds = safeY();

    state.x = clamp(x, half, window.innerWidth - half);
    state.y = clamp(y, bounds.min, bounds.max);

    character.style.transform =
      "translate3d(" + state.x + "px, " + state.y + "px, 0) translate(-50%, -50%)";

    positionThought();
  }

  function positionThought() {
    const width = window.innerWidth <= 720 ? 100 : 110;
    const left = clamp(
      state.x - width * 0.50 + 6,
      8,
      Math.max(8, window.innerWidth - width - 8)
    );
    thought.style.left = left + "px";
    thought.style.top = Math.max(52, state.y - 42) + "px";
  }

  function setExpression(name, duration = 1000, force = false) {
    if (!state.enabled && !force) return;

    const next = expressionNames.includes(name) ? name : "neutral";
    character.dataset.state = state.sleeping ? "sleeping" : next;

    clearTimeout(state.expressionTimer);

    if (duration > 0) {
      state.expressionTimer = setTimeout(() => {
        if (!state.enabled || state.dragging || state.sleeping || now() < state.angerUntil) return;
        character.dataset.state = "neutral";
      }, duration);
    }
  }

  function showThought(message, duration = 1500, force = false) {
    if (!state.enabled || (!state.bubbleEnabled && !force) || !message) return;

    thoughtText.textContent = message;
    positionThought();
    thought.classList.add("is-visible");

    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(() => {
      thought.classList.remove("is-visible");
    }, duration);
  }

  function hideThought() {
    clearTimeout(state.bubbleTimer);
    thought.classList.remove("is-visible");
  }

  function clearMovementFrame() {
    if (state.moveAnimation) cancelAnimationFrame(state.moveAnimation);
    state.moveAnimation = 0;
    state.moveToken += 1;
  }

  function clearBurstTimers() {
    state.burstToken += 1;
    state.burstTimers.forEach((timer) => clearTimeout(timer));
    state.burstTimers = [];
    state.burstActive = false;
    character.dataset.burst = "false";
  }

  function addBurstTimer(fn, delay) {
    const timer = setTimeout(fn, delay);
    state.burstTimers.push(timer);
    return timer;
  }

  function stopNormalRoam() {
    state.roamActive = false;
    state.roamPauseUntil = 0;
    state.velocityX = 0;
    state.velocityY = 0;
  }

  function stopAllMovement() {
    clearBurstTimers();
    clearMovementFrame();
    stopNormalRoam();
    character.dataset.moving = "false";
    character.dataset.direction = "idle";
    visual.style.transform = "";
  }

  function wake() {
    if (!state.sleeping) return;

    state.sleeping = false;
    state.lastMeaningfulActivity = now();
    state.nextBlink = now() + random(2500, 5000);
    character.dataset.state = "curious";
    setExpression("curious", 900, true);
  }

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging) return;

    character.dataset.blink = "true";
    state.lastBlink = now();

    setTimeout(() => {
      if (state.enabled) character.dataset.blink = "false";
    }, 140);
  }

  function setGazeTarget(x, y, immediate = false) {
    const dx = x - state.x;
    const dy = y - state.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const scale = clamp(distance / 170, 0.45, 1);

    const gx = clamp(dx / 130, -1, 1) * 6.5 * scale;
    const gy = clamp(dy / 110, -1, 1) * 5.8 * scale;

    state.gazeTargetX = clamp(gx, -7.2, 7.2);
    state.gazeTargetY = clamp(gy, -6.2, 6.2);

    if (immediate) {
      state.gazeX = state.gazeTargetX;
      state.gazeY = state.gazeTargetY;
    }
  }

  function updateGaze() {
    const ease = 0.14;
    state.gazeX += (state.gazeTargetX - state.gazeX) * ease;
    state.gazeY += (state.gazeTargetY - state.gazeY) * ease;

    eyes.forEach((eye) => {
      eye.style.setProperty("--gaze-x", state.gazeX.toFixed(2) + "px");
      eye.style.setProperty("--gaze-y", state.gazeY.toFixed(2) + "px");
    });
  }

  function chooseNormalTarget() {
    const marginX = safeX() + 30;
    const bounds = safeY();

    let x = random(marginX, Math.max(marginX + 20, window.innerWidth - marginX));
    let y = random(bounds.min + 8, Math.max(bounds.min + 25, bounds.max - 8));

    const distance = Math.hypot(x - state.x, y - state.y);
    if (distance < 180) {
      const angle = random(0, Math.PI * 2);
      x = clamp(state.x + Math.cos(angle) * 280, marginX, window.innerWidth - marginX);
      y = clamp(state.y + Math.sin(angle) * 220, bounds.min + 8, bounds.max - 8);
    }

    state.targetX = x;
    state.targetY = y;
  }

  function startNormalRoam() {
    if (!state.enabled || state.sleeping || state.dragging || reducedMotion || state.burstActive) return;

    state.roamActive = true;
    state.roamLastFrame = performance.now();
    chooseNormalTarget();

    if (state.velocityX === 0 && state.velocityY === 0) {
      const angle = random(0, Math.PI * 2);
      state.velocityX = Math.cos(angle) * 8;
      state.velocityY = Math.sin(angle) * 7;
    }
  }

  function updateNormalRoam(timestamp) {
    if (
      !state.enabled ||
      state.sleeping ||
      state.dragging ||
      state.burstActive ||
      reducedMotion ||
      !state.roamActive
    ) {
      state.roamLastFrame = timestamp;
      return;
    }

    const dt = clamp((timestamp - state.roamLastFrame) / 1000, 0.001, 0.04);
    state.roamLastFrame = timestamp;

    if (now() < state.roamPauseUntil) {
      const brake = Math.pow(0.025, dt);
      state.velocityX *= brake;
      state.velocityY *= brake;
    } else {
      const dx = state.targetX - state.x;
      const dy = state.targetY - state.y;
      const distance = Math.max(1, Math.hypot(dx, dy));

      if (distance < 42) {
        chooseNormalTarget();
        if (Math.random() < 0.22) {
          state.roamPauseUntil = now() + random(600, 1200);
        }
      }

      const maxSpeed = 34 + Math.sin(now() * 0.0007) * 3;
      const desiredSpeed = maxSpeed * clamp(distance / 190, 0.22, 1);
      let desiredX = dx / distance * desiredSpeed;
      let desiredY = dy / distance * desiredSpeed;

      const edge = 105;
      if (state.x < edge) desiredX += (edge - state.x) / edge * 44;
      if (state.x > window.innerWidth - edge) desiredX -= (state.x - (window.innerWidth - edge)) / edge * 44;
      if (state.y < 95) desiredY += (95 - state.y) / 95 * 34;
      if (state.y > window.innerHeight - 118) desiredY -= (state.y - (window.innerHeight - 118)) / 118 * 34;

      const curve = Math.sin(now() * 0.00036) * 0.12;
      desiredX += -desiredY * curve;
      desiredY += desiredX * curve;

      const response = 1 - Math.exp(-dt / 0.85);
      state.velocityX += (desiredX - state.velocityX) * response;
      state.velocityY += (desiredY - state.velocityY) * response;

      const speed = Math.hypot(state.velocityX, state.velocityY);
      if (speed > 42) {
        const scale = 42 / speed;
        state.velocityX *= scale;
        state.velocityY *= scale;
      }
    }

    setPosition(
      state.x + state.velocityX * dt,
      state.y + state.velocityY * dt
    );

    const speed = Math.hypot(state.velocityX, state.velocityY);
    character.dataset.moving = speed > 4 ? "true" : "false";
    character.dataset.direction = speed > 4
      ? (Math.abs(state.velocityY) > Math.abs(state.velocityX) * 0.7
        ? (state.velocityY < 0 ? "up" : "down")
        : (state.velocityX < 0 ? "left" : "right"))
      : "idle";
  }

  function burstTarget() {
    const marginX = 70;
    const yMin = 88;
    const yMax = Math.max(yMin + 25, window.innerHeight - 102);
    return {
      x: random(marginX, Math.max(marginX + 20, window.innerWidth - marginX)),
      y: random(yMin, yMax)
    };
  }

  function burstDuration(direction) {
    if (direction === "up") return 1120;
    if (direction === "down") return 520;
    return 760;
  }

  function cubicBezierEase(t, x1, y1, x2, y2) {
    let low = 0;
    let high = 1;
    let guess = t;

    function cubicX(p) {
      const m = 1 - p;
      return 3 * m * m * p * x1 + 3 * m * p * p * x2 + p * p * p;
    }

    function cubicY(p) {
      const m = 1 - p;
      return 3 * m * m * p * y1 + 3 * m * p * p * y2 + p * p * p;
    }

    for (let i = 0; i < 8; i++) {
      const current = cubicX(guess) - t;
      const derivative =
        3 * (1 - guess) * (1 - guess) * x1 +
        6 * (1 - guess) * guess * (x2 - x1) +
        3 * guess * guess * (1 - x2);

      if (Math.abs(derivative) < 0.00001) break;
      guess = clamp(guess - current / derivative, 0, 1);
    }

    for (let i = 0; i < 10; i++) {
      const current = cubicX(guess);
      if (Math.abs(current - t) < 0.00001) break;
      if (current < t) low = guess;
      else high = guess;
      guess = (low + high) / 2;
    }

    return cubicY(guess);
  }

  function runBurstMove(targetX, targetY, done) {
    if (!state.enabled || state.dragging || state.sleeping || reducedMotion) {
      done?.();
      return;
    }

    clearMovementFrame();

    const startX = state.x;
    const startY = state.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const direction =
      Math.abs(dy) > Math.abs(dx) * 0.7
        ? (dy < 0 ? "up" : "down")
        : (dx < 0 ? "left" : "right");

    const duration = burstDuration(direction);
    const started = performance.now();
    const token = state.moveToken;

    character.dataset.moving = "true";
    character.dataset.direction = direction;

    const frame = (timestamp) => {
      if (
        token !== state.moveToken ||
        !state.enabled ||
        state.dragging ||
        state.sleeping ||
        !state.burstActive
      ) return;

      const progress = clamp((timestamp - started) / duration, 0, 1);
      const eased = direction === "down"
        ? cubicBezierEase(progress, 0.15, 0.90, 0.28, 1.25)
        : direction === "up"
          ? cubicBezierEase(progress, 0.22, 0.68, 0.18, 1)
          : cubicBezierEase(progress, 0.22, 0.78, 0.20, 1);

      setPosition(startX + dx * eased, startY + dy * eased);

      if (progress < 1) {
        state.moveAnimation = requestAnimationFrame(frame);
        return;
      }

      state.moveAnimation = 0;
      character.dataset.moving = "false";
      character.dataset.direction = "idle";

      if (typeof done === "function") done();
    };

    state.moveAnimation = requestAnimationFrame(frame);
  }

  function runEnableBurst() {
    if (!state.enabled || reducedMotion) {
      startNormalRoam();
      return;
    }

    clearBurstTimers();
    clearMovementFrame();
    stopNormalRoam();

    state.burstActive = true;
    state.burstToken += 1;
    const token = state.burstToken;
    character.dataset.burst = "true";

    let hops = 0;

    const finish = () => {
      if (token !== state.burstToken || !state.enabled) return;
      state.burstActive = false;
      character.dataset.burst = "false";
      state.nextBlink = now() + random(2500, 5000);
      startNormalRoam();
    };

    const hop = () => {
      if (token !== state.burstToken || !state.enabled || state.dragging || state.sleeping) return;

      const target = burstTarget();
      runBurstMove(target.x, target.y, () => {
        if (token !== state.burstToken || !state.enabled) return;

        hops += 1;
        if (hops < 3) {
          addBurstTimer(hop, 150);
        } else {
          addBurstTimer(finish, 420);
        }
      });
    };

    hop();
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

  function enablePet() {
    if (state.enabled) {
      updateControls();
      return;
    }

    save(KEY.enabled, true);
    state.enabled = true;
    state.sleeping = false;
    state.angerLevel = 0;
    state.angerUntil = 0;
    clearTimeout(state.angerTimer);

    stage.classList.remove("is-disabled");
    character.classList.remove("is-fading-out");
    character.style.pointerEvents = "auto";
    character.dataset.danger = "false";
    character.dataset.state = "delighted";

    state.lastMeaningfulActivity = now();
    state.lastInteraction = now();
    updateControls();
    setExpression("delighted", 1200, true);
    showThought("I'm back.", 1100);

    runEnableBurst();
  }

  function disablePet() {
    if (!state.enabled) {
      updateControls();
      return;
    }

    save(KEY.enabled, false);
    state.enabled = false;
    state.sleeping = false;
    state.dragging = false;
    state.angerLevel = 0;
    state.angerUntil = 0;

    clearTimeout(state.angerTimer);
    hideThought();
    clearBurstTimers();
    clearMovementFrame();
    stopNormalRoam();

    character.dataset.moving = "false";
    character.dataset.direction = "idle";
    character.dataset.danger = "false";
    character.dataset.state = "sad";
    character.style.pointerEvents = "none";
    character.classList.add("is-fading-out");
    stage.classList.remove("is-disabled");

    setTimeout(() => {
      if (!state.enabled) stage.classList.add("is-disabled");
    }, 920);

    updateControls();
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
      updateControls();
    });
  });

  bubbleEnableButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.bubbleEnabled = true;
    save(KEY.bubble, true);
    showThought("Message box enabled.", 1000, true);
    updateControls();
  });

  bubbleDisableButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.bubbleEnabled = false;
    save(KEY.bubble, false);
    hideThought();
    updateControls();
  });

  closeButton.addEventListener("click", () => {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.classList.remove("is-open");
  });

  launcher.addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    launcher.setAttribute("aria-expanded", String(opening));
    launcher.classList.toggle("is-open", opening);

    if (opening) updateControls();
  });

  function registerMeaningfulActivity() {
    state.lastMeaningfulActivity = now();
    state.lastInteraction = now();
  }

  function handlePetPress(event) {
    if (!state.enabled || state.sleeping) {
      wake();
      return;
    }

    if (state.angerUntil > now()) {
      enterAnger(Math.max(3, state.angerLevel || 3));
      return;
    }

    const time = now();
    state.clickTimes = state.clickTimes.filter((stamp) => time - stamp < 1200);
    state.clickTimes.push(time);

    registerMeaningfulActivity();

    if (state.clickTimes.length >= 3) {
      enterAnger(Math.min(5, state.clickTimes.length));
    } else if (state.clickTimes.length === 2) {
      setExpression("annoyed", 800, true);
      showThought("Easy.", 800);
    } else {
      setExpression("curious", 800, true);
      showThought("Hm?", 750);
    }
  }

  function enterAnger(level) {
    if (!state.enabled) return;

    state.sleeping = false;
    state.angerLevel = clamp(level, 1, 5);
    state.angerUntil = now() + random(3800, 5600);
    character.dataset.danger = "true";
    setExpression("angry", 1200, true);
    showThought(state.angerLevel >= 4 ? "Stop poking me." : "Easy there.", 1050);

    clearTimeout(state.angerTimer);
    state.angerTimer = setTimeout(() => {
      state.angerLevel = 0;
      state.angerUntil = 0;
      character.dataset.danger = "false";
      if (!state.dragging && !state.sleeping) setExpression("neutral", 700);
    }, 5900);
  }

  function startDrag(event) {
    if (!state.enabled) return;

    if (state.angerUntil > now()) {
      enterAnger(Math.max(3, state.angerLevel || 3));
      event.preventDefault();
      return;
    }
    clearBurstTimers();
    clearMovementFrame();
    stopNormalRoam();

    state.dragging = false;
    state.pointerId = event.pointerId;
    state.dragOffsetX = event.clientX - state.x;
    state.dragOffsetY = event.clientY - state.y;
    state.pressX = event.clientX;
    state.pressY = event.clientY;
    state.pointerMoved = false;

    character.setPointerCapture?.(event.pointerId);
    wake();
    registerMeaningfulActivity();
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
      setExpression("scared", 1000, true);
    }

    state.pointerMoved = true;
    setPosition(
      event.clientX - state.dragOffsetX,
      event.clientY - state.dragOffsetY
    );
    setGazeTarget(event.clientX, event.clientY);
    state.lastInteraction = now();
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

    if (dragged) {
      setExpression("relieved", 900, true);
      if (state.enabled && !state.sleeping && state.angerUntil <= now()) {
        startNormalRoam();
      }
    }

    return dragged;
  }

  function trackPointerTarget() {
    if (!state.enabled) return;

    const element = document.elementFromPoint(
      clamp(state.pointerX, 1, window.innerWidth - 1),
      clamp(state.pointerY, 1, window.innerHeight - 1)
    );

    if (element === state.lastHover) return;

    clearTimeout(state.hoverTimer);
    state.lastHover = element;

    const interactive = element?.closest?.("a, button, input, select, textarea, .subject-card, .utility-card, .telegram-card, .card, .resource-card, .tool-card");

    if (!interactive || interactive === character || character.contains(interactive) || panel.contains(interactive)) return;

    state.hoverTimer = setTimeout(() => {
      if (!state.enabled || state.dragging || state.sleeping) return;
      setExpression("curious", 650);
    }, 180);
  }

  character.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    startDrag(event);
    event.preventDefault();
  });

  character.addEventListener("pointermove", moveDrag);

  character.addEventListener("pointerup", (event) => {
    const dragged = endDrag(event);
    if (!dragged) handlePetPress(event);
  });

  character.addEventListener("pointercancel", endDrag);

  character.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handlePetPress(event);
  });

  document.addEventListener("pointermove", (event) => {
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;

    if (state.pointerId === event.pointerId) {
      moveDrag(event);
      return;
    }

    if (state.enabled && !state.dragging) {
      setGazeTarget(event.clientX, event.clientY);
      trackPointerTarget();

      if (state.angerUntil > now()) {
        const distance = Math.hypot(event.clientX - state.x, event.clientY - state.y);
        const radius = state.angerLevel >= 4 ? 230 : 190;
      }
    }

    if (state.sleeping) wake();
  }, { passive: true });

  document.addEventListener("click", (event) => {
    if (!state.enabled) return;
    if (panel.contains(event.target) || event.target === launcher || character.contains(event.target)) return;

    const target = event.target.closest?.("a, button, input, select, textarea, .subject-card, .utility-card, .telegram-card, .card, .resource-card, .tool-card");
    if (!target) return;

    registerMeaningfulActivity();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (state.enabled && state.sleeping) wake();
  });

  window.addEventListener("resize", () => {
    setPosition(
      clamp(state.x, safeX(), window.innerWidth - safeX()),
      clamp(state.y, safeY().min, safeY().max)
    );
    if (state.enabled && !state.sleeping && !state.dragging && !state.burstActive && !state.roamActive) {
      startNormalRoam();
    }
  }, { passive: true });

  function lifeLoop() {
    const timestamp = performance.now();

    updateGaze();
    updateNormalRoam(timestamp);

    if (!state.enabled || document.hidden || state.dragging) {
      requestAnimationFrame(lifeLoop);
      return;
    }

    const time = now();
    const idleFor = time - state.lastMeaningfulActivity;

    if (state.sleeping) {
      if (time - state.sleepStartedAt > 5000 && Math.random() < 0.01) {
        character.dataset.blink = "true";
        setTimeout(() => { character.dataset.blink = "false"; }, 120);
      }
      requestAnimationFrame(lifeLoop);
      return;
    }

    if (time >= state.nextBlink) {
      state.nextBlink = time + random(6000, 10400);
      blink();
    }

    if (time >= state.nextThought && state.bubbleEnabled) {
      state.nextThought = time + random(14000, 24000);
      showThought(pick(thoughts), 1400);
    }

    if (idleFor >= 42000 && !state.burstActive && state.angerUntil <= time) {
      state.sleeping = true;
      state.sleepStartedAt = time;
      character.dataset.state = "sleeping";
      stopAllMovement();
      hideThought();
    }

    if (state.angerUntil > time && !state.dragging) {
      const distance = Math.hypot(state.pointerX - state.x, state.pointerY - state.y);
      const radius = state.angerLevel >= 4 ? 230 : 190;
    } else if (state.angerUntil <= time && state.angerLevel > 0) {
      state.angerLevel = 0;
      state.angerUntil = 0;
      character.dataset.danger = "false";
    }

    requestAnimationFrame(lifeLoop);
  }

  character.dataset.eye = state.eye;
  setPosition(state.x, state.y);
  updateControls();

  if (state.enabled) {
    stage.classList.remove("is-disabled");
    character.style.pointerEvents = "auto";
    startNormalRoam();
  } else {
    stage.classList.add("is-disabled");
    character.style.pointerEvents = "none";
    character.dataset.state = "sad";
  }

  setTimeout(() => {
    if (state.enabled && !state.sleeping) setExpression("curious", 900, true);
  }, 650);

  requestAnimationFrame(lifeLoop);
})();
