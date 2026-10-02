
/*
 * StudyLab Living Pet v2 — preview feature
 * Global page-level companion. No simulation integration.
 */
(function () {
  "use strict";

  if (window.__StudyLabLivingPetV2) return;
  window.__StudyLabLivingPetV2 = true;

  const STORAGE = {
    enabled: "studylab-pet-enabled",
    eye: "studylab-pet-eye-v2",
    position: "studylab-pet-position-v2"
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    enabled: readBool(STORAGE.enabled, true),
    eye: readEye(),
    context: getContext(),
    mood: "idle",
    sleeping: false,
    dragging: false,
    dragMoved: false,
    hoverInside: false,
    anger: 0,
    lastMeaningfulActivity: Date.now(),
    lastReaction: 0,
    lastWander: 0,
    lastHoverReaction: 0,
    lastBlink: Date.now() + 2800,
    cursorX: window.innerWidth * 0.70,
    cursorY: window.innerHeight * 0.58,
    gazeStrength: 1,
    position: loadPosition(),
    dragOffsetX: 0,
    dragOffsetY: 0,
    pressX: 0,
    pressY: 0,
    pressTime: 0,
    savedPosition: null,
    messageTimer: null,
    reactionTimer: null,
    wanderTimer: null,
    sleepTimer: null,
    wakeTimer: null
  };

  const css = [
    ".sl-pet-launcher{position:fixed;right:126px;bottom:20px;z-index:954;display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:8px 12px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(10,18,30,.62);color:var(--text-primary,#eef5ff);box-shadow:0 14px 34px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(20px) saturate(155%);-webkit-backdrop-filter:blur(20px) saturate(155%);font:inherit;font-size:.78rem;font-weight:780;cursor:pointer;transition:transform .22s ease,background .22s ease,border-color .22s ease,box-shadow .22s ease}",
    ".sl-pet-launcher:hover,.sl-pet-launcher[aria-expanded=true]{transform:translateY(-2px);background:rgba(24,36,54,.76);border-color:rgba(126,220,255,.28);box-shadow:0 18px 40px rgba(0,0,0,.25),0 0 26px rgba(126,220,255,.05)}",
    ".sl-pet-launcher:focus-visible,.sl-pet-panel button:focus-visible{outline:2px solid rgba(126,220,255,.68);outline-offset:2px}",
    ".sl-pet-launcher-mark{width:17px;height:17px;border-radius:5px;background:#020305;border:1px solid rgba(126,220,255,.28);box-shadow:inset 0 0 0 1px rgba(255,255,255,.035),0 0 10px rgba(126,220,255,.08);position:relative}",
    ".sl-pet-launcher-mark:before,.sl-pet-launcher-mark:after{content:\"\";position:absolute;top:5px;width:3px;height:5px;border-radius:2px;background:#73e4ff;box-shadow:0 0 5px rgba(115,228,255,.7)}",
    ".sl-pet-launcher-mark:before{left:3px}.sl-pet-launcher-mark:after{right:3px}",
    ".sl-pet-panel{position:fixed;right:20px;bottom:72px;z-index:955;width:min(340px,calc(100vw - 28px));padding:16px;border:1px solid rgba(255,255,255,.14);border-radius:20px;background:rgba(8,16,29,.80);color:var(--text-primary,#eef5ff);box-shadow:0 28px 80px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(28px) saturate(165%);-webkit-backdrop-filter:blur(28px) saturate(165%)}",
    ".sl-pet-panel[hidden]{display:none}",
    ".sl-pet-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}",
    ".sl-pet-panel-head strong{display:block;font-size:.96rem}.sl-pet-panel-head small{display:block;margin-top:3px;color:var(--text-muted,#91a9c2);font-size:.68rem;line-height:1.45}",
    ".sl-pet-panel-close{width:32px;height:32px;border:0;border-radius:10px;background:rgba(255,255,255,.07);color:inherit;cursor:pointer;font:inherit;font-size:1.1rem}",
    ".sl-pet-setting{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 2px;border-top:1px solid rgba(255,255,255,.07)}",
    ".sl-pet-setting>span{color:var(--text-secondary,#a9bdd4);font-size:.76rem;font-weight:720}",
    ".sl-pet-setting-buttons{display:inline-flex;gap:6px}.sl-pet-setting-buttons button{min-width:58px;padding:7px 9px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.045);color:inherit;cursor:pointer;font:inherit;font-size:.68rem;font-weight:740}",
    ".sl-pet-setting-buttons button:hover,.sl-pet-setting-buttons button.is-active{background:rgba(126,220,255,.11);border-color:rgba(126,220,255,.30);color:#8fe7ff}",
    ".sl-pet-panel-note{margin:11px 2px 2px;color:var(--text-muted,#8fa7c1);font-size:.68rem;line-height:1.55}",
    ".sl-pet-stage{position:fixed;inset:0;z-index:953;pointer-events:none;overflow:hidden;user-select:none}",
    ".sl-pet-character{position:absolute;width:88px;height:68px;left:0;top:0;border-radius:17px;background:#020306;border:1px solid rgba(255,255,255,.11);box-shadow:0 18px 42px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.055),0 0 24px rgba(126,220,255,.035);pointer-events:auto;cursor:grab;touch-action:none;will-change:left,top,transform}",
    ".sl-pet-character:before{content:\"\";position:absolute;inset:1px;border-radius:16px;background:radial-gradient(circle at 22% 16%,rgba(255,255,255,.055),transparent 26%),linear-gradient(180deg,rgba(255,255,255,.012),transparent 44%);pointer-events:none}",
    ".sl-pet-character[data-eye=pink]{box-shadow:0 18px 42px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.055),0 0 24px rgba(255,131,197,.04)}",
    ".sl-pet-screen{position:absolute;inset:0}.sl-pet-eye{position:absolute;top:21px;width:22px;height:27px;overflow:visible}",
    ".sl-pet-eye-left{left:17px}.sl-pet-eye-right{right:17px}",
    ".sl-pet-eye i{position:absolute;left:50%;top:50%;width:20px;height:25px;border-radius:6px;background:#74e5ff;box-shadow:0 0 11px rgba(116,229,255,.72),0 0 24px rgba(116,229,255,.20);transform:translate(calc(-50% + var(--gaze-x,0px)),calc(-50% + var(--gaze-y,0px))) rotate(var(--eye-rotate,0deg));transition:width .18s ease,height .18s ease,border-radius .18s ease,box-shadow .18s ease,background .18s ease}",
    ".sl-pet-character[data-eye=pink] .sl-pet-eye i{background:#ff83c5;box-shadow:0 0 11px rgba(255,131,197,.72),0 0 24px rgba(255,131,197,.20)}",
    ".sl-pet-character[data-state=curious] .sl-pet-eye i{width:23px;height:29px}",
    ".sl-pet-character[data-state=happy] .sl-pet-eye i{width:20px;height:14px;border-radius:8px 8px 13px 13px}",
    ".sl-pet-character[data-state=focused] .sl-pet-eye i{width:18px;height:26px}",
    ".sl-pet-character[data-state=angry] .sl-pet-eye i{width:23px;height:15px;border-radius:7px;--eye-rotate:-14deg}",
    ".sl-pet-character[data-state=angry] .sl-pet-eye-right i{--eye-rotate:14deg}",
    ".sl-pet-character[data-state=scared] .sl-pet-eye i{width:25px;height:31px;border-radius:7px;box-shadow:0 0 14px rgba(116,229,255,.86),0 0 28px rgba(116,229,255,.28)}",
    ".sl-pet-character[data-eye=pink][data-state=scared] .sl-pet-eye i{box-shadow:0 0 14px rgba(255,131,197,.86),0 0 28px rgba(255,131,197,.28)}",
    ".sl-pet-character[data-state=confused] .sl-pet-eye-left i{--eye-rotate:-7deg;width:22px;height:24px}",
    ".sl-pet-character[data-state=confused] .sl-pet-eye-right i{--eye-rotate:8deg;width:19px;height:27px}",
    ".sl-pet-character[data-state=sleeping] .sl-pet-eye i{width:22px;height:4px;border-radius:999px;box-shadow:0 0 7px rgba(116,229,255,.30)}",
    ".sl-pet-character[data-eye=pink][data-state=sleeping] .sl-pet-eye i{box-shadow:0 0 7px rgba(255,131,197,.30)}",
    ".sl-pet-character.is-blinking .sl-pet-eye i{height:3px;border-radius:999px;box-shadow:none}",
    ".sl-pet-character[data-state=angry]{animation:slPetAngry .46s ease-in-out 0s 2}.sl-pet-character[data-state=happy]{animation:slPetHappy .72s cubic-bezier(.2,.8,.2,1)}",
    ".sl-pet-character[data-state=curious]{animation:slPetCurious .62s ease}.sl-pet-character[data-state=confused]{animation:slPetConfused .52s ease}.sl-pet-character[data-state=scared]{animation:slPetScared .55s ease-in-out 0s 2}",
    ".sl-pet-character[data-state=focused]{animation:slPetFocused 1.8s ease-in-out infinite}.sl-pet-character[data-state=sleeping]{animation:slPetSleep 3.4s ease-in-out infinite}",
    "@keyframes slPetHappy{0%,100%{margin-top:0;transform:rotate(0deg) scale(1)}45%{margin-top:-7px;transform:rotate(-2deg) scale(1.04)}}",
    "@keyframes slPetCurious{0%,100%{transform:rotate(0deg) scale(1)}40%{transform:rotate(-5deg) scale(1.02)}75%{transform:rotate(3deg) scale(1)}}",
    "@keyframes slPetConfused{0%,100%{transform:rotate(0deg)}30%{transform:rotate(-6deg)}68%{transform:rotate(6deg)}}",
    "@keyframes slPetScared{0%,100%{transform:translateX(0) rotate(0deg)}30%{transform:translateX(-4px) rotate(-4deg)}65%{transform:translateX(4px) rotate(4deg)}}",
    "@keyframes slPetAngry{0%,100%{transform:translateX(0) rotate(0deg)}25%{transform:translateX(-5px) rotate(-4deg)}75%{transform:translateX(5px) rotate(4deg)}}",
    "@keyframes slPetFocused{0%,100%{margin-top:0}50%{margin-top:-2px}}",
    "@keyframes slPetSleep{0%,100%{margin-top:0;transform:rotate(0deg)}50%{margin-top:2px;transform:rotate(-1deg)}}",
    ".sl-pet-shadow{position:absolute;width:58px;height:9px;border-radius:999px;background:rgba(0,0,0,.24);filter:blur(5px);opacity:.56;pointer-events:none}",
    ".sl-pet-bubble{position:absolute;min-width:70px;max-width:220px;padding:8px 11px;border:1px solid rgba(255,255,255,.13);border-radius:14px 14px 5px 14px;background:rgba(8,16,29,.78);color:#eaf5ff;box-shadow:0 16px 34px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.065);backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);font-size:.68rem;font-weight:760;line-height:1.36;opacity:0;transform:translateY(5px) scale(.97);transition:opacity .22s ease,transform .22s ease;pointer-events:none}",
    ".sl-pet-bubble.is-visible{opacity:1;transform:translateY(0) scale(1)}",
    ".sl-pet-stars{position:absolute;inset:-18px -24px -22px;pointer-events:none;opacity:0;transform:scale(.65)}",
    ".sl-pet-stars.is-bursting{opacity:1;animation:slPetStars .85s cubic-bezier(.16,.78,.2,1)}",
    ".sl-pet-star{position:absolute;left:50%;top:50%;font-size:13px;color:#a8ecff;text-shadow:0 0 9px rgba(126,220,255,.85);animation:slPetStarOrbit .82s ease-out forwards;animation-delay:var(--d,0s);transform-origin:center}",
    ".sl-pet-star:nth-child(1){--a:0deg;--r:30px}.sl-pet-star:nth-child(2){--a:60deg;--r:33px}.sl-pet-star:nth-child(3){--a:120deg;--r:30px}.sl-pet-star:nth-child(4){--a:180deg;--r:34px}.sl-pet-star:nth-child(5){--a:240deg;--r:31px}.sl-pet-star:nth-child(6){--a:300deg;--r:34px}",
    "@keyframes slPetStars{0%{opacity:0;transform:scale(.65)}20%,80%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.08)}}",
    "@keyframes slPetStarOrbit{0%{transform:translate(-50%,-50%) rotate(var(--a)) translateX(5px) scale(.45);opacity:0}26%{opacity:1}100%{transform:translate(-50%,-50%) rotate(calc(var(--a) + 38deg)) translateX(var(--r)) scale(1);opacity:0}}",
    ".sl-pet-character.is-dragging{cursor:grabbing;box-shadow:0 24px 52px rgba(0,0,0,.42),0 0 28px rgba(126,220,255,.12);z-index:2}",
    ".sl-pet-character.is-dragging[data-eye=pink]{box-shadow:0 24px 52px rgba(0,0,0,.42),0 0 28px rgba(255,131,197,.12)}",
    ".sl-pet-stage.is-disabled{display:none}",
    "html[data-theme=light] .sl-pet-launcher,html[data-theme=light] .sl-pet-panel,html[data-theme=light] .sl-pet-bubble{background:rgba(255,255,255,.76);color:#17233a;border-color:rgba(255,255,255,.90);box-shadow:0 20px 56px rgba(35,70,105,.14),inset 0 1px 0 rgba(255,255,255,.96)}",
    "html[data-theme=light] .sl-pet-panel-note{color:#607892}html[data-theme=light] .sl-pet-setting>span{color:#607892}",
    "html[data-theme=light] .sl-pet-setting-buttons button{background:rgba(70,110,145,.05);border-color:rgba(70,110,145,.11)}html[data-theme=light] .sl-pet-setting-buttons button:hover,html[data-theme=light] .sl-pet-setting-buttons button.is-active{background:rgba(40,150,195,.09);border-color:rgba(40,150,195,.22);color:#14739d}",
    "@media(max-width:720px){.sl-pet-launcher{right:94px;bottom:12px;min-height:38px;padding:7px 10px}.sl-pet-panel{right:12px;bottom:60px}.sl-pet-character{width:80px;height:63px}.sl-pet-eye{top:19px}.sl-pet-eye-left{left:15px}.sl-pet-eye-right{right:15px}}",
    "@media(prefers-reduced-motion:reduce){.sl-pet-character{animation:none!important;transition:none!important}.sl-pet-launcher,.sl-pet-panel,.sl-pet-bubble{transition:none!important}.sl-pet-stars{display:none!important}}"
  ];

  const style = document.createElement("style");
  style.setAttribute("data-studylab-pet-v2-style", "");
  style.textContent = css.join("\\n");
  document.head.appendChild(style);

  document.body.insertAdjacentHTML("beforeend",
    '<button class="sl-pet-launcher" type="button" aria-expanded="false" aria-controls="slPetPanel" title="StudyLab Pet controls">' +
      '<span class="sl-pet-launcher-mark" aria-hidden="true"></span><span>Pet</span>' +
    '</button>' +
    '<aside class="sl-pet-panel" id="slPetPanel" hidden aria-label="StudyLab Pet controls">' +
      '<div class="sl-pet-panel-head">' +
        '<div><strong>StudyLab Pet</strong><small>Your little study companion lives on the page and reacts to your activity.</small></div>' +
        '<button class="sl-pet-panel-close" type="button" aria-label="Close pet controls">×</button>' +
      '</div>' +
      '<div class="sl-pet-setting"><span>Pet</span><div class="sl-pet-setting-buttons" role="group" aria-label="Pet enabled state">' +
        '<button type="button" data-pet-enable>Enable</button><button type="button" data-pet-disable>Disable</button>' +
      '</div></div>' +
      '<div class="sl-pet-setting"><span>Eye colour</span><div class="sl-pet-setting-buttons" role="group" aria-label="Pet eye colour">' +
        '<button type="button" data-pet-eye="cyan">Cyan</button><button type="button" data-pet-eye="pink">Pink</button>' +
      '</div></div>' +
      '<p class="sl-pet-panel-note">It follows the cursor with its eyes, wanders intentionally, reacts to StudyLab areas, sleeps when you are idle, and can be picked up and placed anywhere.</p>' +
    '</aside>' +
    '<div class="sl-pet-stage" aria-hidden="true">' +
      '<div class="sl-pet-shadow"></div>' +
      '<div class="sl-pet-character" data-state="idle" data-eye="cyan" tabindex="-1">' +
        '<div class="sl-pet-stars" data-pet-stars>' +
          '<span class="sl-pet-star">✦</span><span class="sl-pet-star">✧</span><span class="sl-pet-star">✦</span><span class="sl-pet-star">✧</span><span class="sl-pet-star">✦</span><span class="sl-pet-star">✧</span>' +
        '</div>' +
        '<div class="sl-pet-screen">' +
          '<div class="sl-pet-eye sl-pet-eye-left"><i></i></div>' +
          '<div class="sl-pet-eye sl-pet-eye-right"><i></i></div>' +
        '</div>' +
      '</div>' +
      '<div class="sl-pet-bubble" data-pet-bubble role="status" aria-live="polite"></div>' +
    '</div>'
  );

  const launcher = document.querySelector(".sl-pet-launcher");
  const panel = document.querySelector(".sl-pet-panel");
  const panelClose = document.querySelector(".sl-pet-panel-close");
  const stage = document.querySelector(".sl-pet-stage");
  const character = document.querySelector(".sl-pet-character");
  const shadow = document.querySelector(".sl-pet-shadow");
  const bubble = document.querySelector("[data-pet-bubble]");
  const stars = document.querySelector("[data-pet-stars]");
  const eyes = Array.from(document.querySelectorAll(".sl-pet-eye i"));
  const enableButton = document.querySelector("[data-pet-enable]");
  const disableButton = document.querySelector("[data-pet-disable]");
  const eyeButtons = Array.from(document.querySelectorAll("[data-pet-eye]"));

  if (!launcher || !panel || !stage || !character) return;

  function readBool(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value === "true";
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
      localStorage.setItem(STORAGE.position, JSON.stringify(state.position));
    } catch (_) {}
  }

  function loadPosition() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE.position) || "null");
      if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
        return { x: value.x, y: value.y };
      }
    } catch (_) {}
    return {
      x: Math.max(22, Math.min(window.innerWidth - 112, window.innerWidth - 148)),
      y: Math.max(104, Math.min(window.innerHeight - 112, window.innerHeight * 0.60))
    };
  }

  function getContext(extra) {
    const path = location.pathname.toLowerCase();
    if (extra) return extra;
    if (path.includes("study-tools")) return "study-tools";
    if (path.includes("physics")) return "physics";
    if (path.includes("chemistry")) return "chemistry";
    if (path.includes("maths")) return "maths";
    if (path.includes("biology")) return "biology";
    if (path.includes("exam-hub")) return "exam-hub";
    if (path.includes("telegram")) return "community";
    if (path.includes("audio_books")) return "community";
    if (path.includes("generalenglish") || path.includes("generalknowledge") || path.includes("git")) return "exam";
    return "home";
  }

  function clampPosition(x, y) {
    const w = character.offsetWidth || 88;
    const h = character.offsetHeight || 68;
    const margin = 14;
    const minY = 72;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - w - margin, x)),
      y: Math.max(minY, Math.min(window.innerHeight - h - margin, y))
    };
  }

  function applyPosition(instant) {
    state.position = clampPosition(state.position.x, state.position.y);
    character.style.transition = instant ? "none" : "left 1.55s cubic-bezier(.18,.82,.18,1),top 1.55s cubic-bezier(.18,.82,.18,1)";
    character.style.left = state.position.x + "px";
    character.style.top = state.position.y + "px";
    shadow.style.left = (state.position.x + 15) + "px";
    shadow.style.top = (state.position.y + (character.offsetHeight || 68) + 2) + "px";
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    syncControls();
    showMessage("Pet controls open 👀", 1200);
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
  }

  function syncControls() {
    if (enableButton) enableButton.classList.toggle("is-active", state.enabled);
    if (disableButton) disableButton.classList.toggle("is-active", !state.enabled);
    eyeButtons.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });
    launcher.setAttribute("aria-label", state.enabled ? "StudyLab Pet controls" : "StudyLab Pet controls, pet disabled");
  }

  function setEnabled(enabled) {
    state.enabled = enabled;
    savePreferences();
    syncControls();
    stage.classList.toggle("is-disabled", !enabled);
    if (enabled) {
      wake("Pet enabled", "happy");
      scheduleWander(1800);
    } else {
      clearTimeout(state.wanderTimer);
      clearTimeout(state.sleepTimer);
      state.sleeping = false;
      setState("idle", 0);
      closePanel();
    }
  }

  function setEye(eye) {
    state.eye = eye === "pink" ? "pink" : "cyan";
    character.dataset.eye = state.eye;
    savePreferences();
    syncControls();
    showMessage(state.eye === "pink" ? "Pink mode 🩷" : "Cyan mode 🔵", 1100);
    react("happy", 700, false);
  }

  function setState(name, duration) {
    if (!character) return;
    character.dataset.state = name;
    if (duration) {
      clearTimeout(state.reactionTimer);
      state.reactionTimer = setTimeout(function () {
        if (state.sleeping) return;
        character.dataset.state = state.context === "study-tools" && name === "idle" ? "focused" : "idle";
      }, duration);
    }
  }

  function react(mood, duration, message) {
    if (!state.enabled || state.dragging) return;
    state.lastReaction = Date.now();
    state.mood = mood;
    setState(mood, duration || 1000);
    if (message) showMessage(message, Math.max(900, (duration || 1000) - 80));
  }

  function showMessage(message, duration) {
    if (!bubble || !state.enabled) return;
    clearTimeout(state.messageTimer);
    bubble.textContent = message;
    bubble.classList.add("is-visible");
    state.messageTimer = setTimeout(function () {
      bubble.classList.remove("is-visible");
    }, duration || 1400);
  }

  function markMeaningfulActivity() {
    state.lastMeaningfulActivity = Date.now();
    if (state.sleeping && state.enabled) wake();
  }

  function wake(message, mood) {
    clearTimeout(state.sleepTimer);
    if (!state.enabled) return;
    const wasSleeping = state.sleeping;
    state.sleeping = false;
    if (wasSleeping) {
      react(mood || "curious", 900, message || "I'm awake 👀");
    } else if (mood) {
      react(mood, 900, message);
    }
    scheduleSleep();
  }

  function scheduleSleep() {
    clearTimeout(state.sleepTimer);
    if (!state.enabled || state.dragging) return;
    const delay = state.context === "study-tools" ? 42000 : 33000;
    state.sleepTimer = setTimeout(function () {
      if (!state.enabled || state.dragging) return;
      if (Date.now() - state.lastMeaningfulActivity < delay - 500) {
        scheduleSleep();
        return;
      }
      state.sleeping = true;
      setState("sleeping", 0);
      showMessage("…zz…", 1200);
    }, delay);
  }

  function getSafeRect() {
    const margin = 22;
    const top = 78;
    return {
      minX: margin,
      maxX: Math.max(margin, window.innerWidth - (character.offsetWidth || 88) - margin),
      minY: top,
      maxY: Math.max(top, window.innerHeight - (character.offsetHeight || 68) - margin)
    };
  }

  function chooseWanderTarget() {
    const safe = getSafeRect();
    const anchors = [
      [0.16,0.26],[0.38,0.22],[0.62,0.24],[0.82,0.31],
      [0.15,0.52],[0.36,0.58],[0.64,0.53],[0.84,0.60],
      [0.20,0.78],[0.42,0.76],[0.66,0.74],[0.84,0.80]
    ];
    const picked = anchors[Math.floor(Math.random() * anchors.length)];
    const jitterX = (Math.random() - 0.5) * 100;
    const jitterY = (Math.random() - 0.5) * 70;
    return clampPosition(
      safe.minX + picked[0] * (safe.maxX - safe.minX) + jitterX,
      safe.minY + picked[1] * (safe.maxY - safe.minY) + jitterY
    );
  }

  function wanderTo(target, reason) {
    if (!state.enabled || state.dragging || state.sleeping) return;
    target = clampPosition(target.x, target.y);
    state.lastWander = Date.now();
    state.position = target;
    applyPosition(false);
    if (reason) {
      react(reason.mood || "curious", reason.duration || 850, false);
    } else {
      setState(state.context === "study-tools" ? "focused" : "idle", 1100);
    }
    savePreferences();
  }

  function scheduleWander(delayOverride) {
    clearTimeout(state.wanderTimer);
    if (!state.enabled || state.dragging || state.sleeping) return;
    const base = state.context === "study-tools" ? 9800 : 16500;
    const delay = delayOverride != null ? delayOverride : base + Math.random() * base * 1.15;
    state.wanderTimer = setTimeout(function () {
      if (!state.enabled || state.dragging || state.sleeping) return;
      const target = chooseWanderTarget();
      wanderTo(target);
      scheduleWander();
    }, delay);
  }

  function moveNearElement(el) {
    if (!el || !state.enabled || state.dragging || state.sleeping) return;
    const rect = el.getBoundingClientRect();
    const choices = [
      { x: rect.left - 104, y: rect.top + rect.height * 0.24 },
      { x: rect.right + 16, y: rect.top + rect.height * 0.28 },
      { x: rect.left + rect.width * 0.55, y: rect.top - 82 },
      { x: rect.left + rect.width * 0.55, y: rect.bottom + 18 }
    ];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    const target = clampPosition(choice.x, choice.y);
    wanderTo(target, { mood: "curious", duration: 980 });
  }

  function inferReaction(target) {
    const href = String(target.getAttribute && target.getAttribute("href") || "").toLowerCase();
    const text = String(target.innerText || target.getAttribute && target.getAttribute("aria-label") || "").toLowerCase();
    const openTool = String(target.dataset && target.dataset.openTool || "").toLowerCase();
    const contextText = (href + " " + text + " " + openTool).trim();

    if (openTool === "pomodoro") return { mood: "focused", message: "Focus mode 👀", move: true };
    if (openTool === "study-time") return { mood: "curious", message: "Planning time?", move: true };
    if (openTool === "marks") return { mood: "focused", message: "Checking marks…", move: true };
    if (openTool === "random") return { mood: "excited", message: "Random? Interesting.", move: false };
    if (openTool === "flashcards") return { mood: "curious", message: "Memory work 👀", move: true };
    if (openTool === "mistakes") return { mood: "concerned", message: "Let's fix that.", move: false };
    if (openTool === "daily") return { mood: "focused", message: "Making a plan.", move: true };
    if (openTool === "mock") return { mood: "focused", message: "Serious mode.", move: true };
    if (openTool === "units") return { mood: "curious", message: "Numbers.", move: false };

    if (contextText.includes("chemistry")) return { mood: "excited", message: "Chemistry detected 🧪", move: true };
    if (contextText.includes("physics")) return { mood: "curious", message: "Physics 👀", move: true };
    if (contextText.includes("math")) return { mood: "focused", message: "Maths time.", move: true };
    if (contextText.includes("biology")) return { mood: "curious", message: "Biology 👀", move: true };
    if (contextText.includes("exam")) return { mood: "focused", message: "Exam mode.", move: false };
    if (contextText.includes("telegram") || contextText.includes("community")) return { mood: "curious", message: "Going social?", move: false };
    if (contextText.includes("tool")) return { mood: "curious", message: "A tool.", move: false };

    return { mood: "curious", message: "", move: false };
  }

  function setGaze() {
    const rect = character.getBoundingClientRect();
    const maxX = 4.8;
    const maxY = 5.0;
    eyes.forEach(function (eye) {
      const eyeRect = eye.parentElement.getBoundingClientRect();
      const dx = state.cursorX - (eyeRect.left + eyeRect.width / 2);
      const dy = state.cursorY - (eyeRect.top + eyeRect.height / 2);
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const scale = Math.min(1, distance / 160) * state.gazeStrength;
      eye.style.setProperty("--gaze-x", (Math.max(-maxX, Math.min(maxX, dx / 34 * scale))) + "px");
      eye.style.setProperty("--gaze-y", (Math.max(-maxY, Math.min(maxY, dy / 34 * scale))) + "px");
    });

    const centerX = rect.left + rect.width / 2;
    const dx = state.cursorX - centerX;
    const near = Math.abs(dx) < 260 && Math.abs(state.cursorY - (rect.top + rect.height / 2)) < 240;
    if (!state.dragging && !state.sleeping) {
      const tilt = Math.max(-4.5, Math.min(4.5, dx / 80));
      character.style.setProperty("--cursor-tilt", near ? tilt + "deg" : "0deg");
      character.style.rotate = "var(--cursor-tilt)";
    }
  }

  function blink() {
    if (!state.enabled || state.sleeping || state.dragging) return;
    state.lastBlink = Date.now();
    character.classList.add("is-blinking");
    setTimeout(function () {
      character.classList.remove("is-blinking");
    }, reducedMotion ? 40 : 130);
  }

  function maybeBlink(now) {
    if (now < state.lastBlink || state.sleeping || state.dragging || !state.enabled) return;
    if (Math.random() < 0.018) blink();
    state.lastBlink = now + 3200 + Math.random() * 3600;
  }

  function triggerStars() {
    if (!stars || reducedMotion) return;
    stars.classList.remove("is-bursting");
    void stars.offsetWidth;
    stars.classList.add("is-bursting");
    setTimeout(function () {
      stars.classList.remove("is-bursting");
    }, 900);
  }

  function onPetPointerDown(event) {
    if (!state.enabled) return;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    markMeaningfulActivity();
    state.dragging = true;
    state.dragMoved = false;
    state.pressX = event.clientX;
    state.pressY = event.clientY;
    state.pressTime = Date.now();
    const rect = character.getBoundingClientRect();
    state.dragOffsetX = event.clientX - rect.left;
    state.dragOffsetY = event.clientY - rect.top;
    character.classList.add("is-dragging");
    clearTimeout(state.wanderTimer);
    clearTimeout(state.sleepTimer);
    setState("scared", 0);
    showMessage("Hey… careful! 😳", 950);
    try { character.setPointerCapture(event.pointerId); } catch (_) {}
  }

  function onPetPointerMove(event) {
    if (!state.dragging) return;
    const moved = Math.hypot(event.clientX - state.pressX, event.clientY - state.pressY);
    if (moved > 5) state.dragMoved = true;
    state.position = clampPosition(
      event.clientX - state.dragOffsetX,
      event.clientY - state.dragOffsetY
    );
    character.style.transition = "none";
    character.style.left = state.position.x + "px";
    character.style.top = state.position.y + "px";
    shadow.style.left = (state.position.x + 15) + "px";
    shadow.style.top = (state.position.y + (character.offsetHeight || 68) + 2) + "px";
    state.cursorX = event.clientX;
    state.cursorY = event.clientY;
    setState("scared", 0);
    setGaze();
  }

  function onPetPointerUp(event) {
    if (!state.dragging) return;
    state.dragging = false;
    character.classList.remove("is-dragging");
    try { character.releasePointerCapture(event.pointerId); } catch (_) {}
    savePreferences();
    markMeaningfulActivity();

    const wasDrag = state.dragMoved;
    state.dragMoved = false;

    if (wasDrag) {
      setState("happy", 900);
      triggerStars();
      showMessage("Nice spot ✨", 1150);
      scheduleWander(42000);
    } else {
      state.anger = Math.min(4, state.anger + 1);
      setState("angry", 900);
      if (state.anger >= 3) {
        showMessage("Stop poking me. 😠", 1300);
        const safe = clampPosition(
          state.position.x + (Math.random() > 0.5 ? 95 : -95),
          state.position.y + (Math.random() > 0.5 ? 50 : -50)
        );
        setTimeout(function () {
          if (!state.dragging && state.enabled) wanderTo(safe, { mood: "angry", duration: 800 });
        }, 600);
      } else {
        showMessage(state.anger === 1 ? "Hey! 😠" : "Again? Really? 😤", 1100);
      }
      setTimeout(function () {
        if (state.anger > 0) state.anger -= 1;
      }, 5200);
      scheduleWander(12000);
    }

    scheduleSleep();
  }

  function onPetPointerEnter() {
    state.hoverInside = true;
    if (!state.dragging && state.enabled && !state.sleeping) {
      react("scared", 620, false);
      showMessage("👀", 650);
    }
  }

  function onPetPointerLeave() {
    state.hoverInside = false;
    if (!state.dragging && state.enabled && !state.sleeping) {
      setState("idle", 700);
    }
  }

  function handleInteractiveHover(target) {
    if (!state.enabled || state.dragging || Date.now() - state.lastHoverReaction < 1000) return;
    if (!(target instanceof Element)) return;
    if (target.closest(".sl-pet-stage,.sl-pet-launcher,.sl-pet-panel")) return;
    const actionable = target.closest("a,button,[role=button],[data-open-tool],input,select,textarea");
    if (!actionable) return;

    state.lastHoverReaction = Date.now();
    const reaction = inferReaction(actionable);
    const isProfile = actionable.id === "profileName" || actionable.matches("#profileName");
    if (isProfile) {
      react("curious", 1200, "Who are you? 👀");
      pointGazeToElement(actionable);
      return;
    }

    if (reaction.mood === "excited") react("happy", 850, reaction.message);
    else if (reaction.mood === "focused") react("focused", 1050, reaction.message);
    else if (reaction.mood === "concerned") react("confused", 950, reaction.message);
    else if (reaction.message) react(reaction.mood || "curious", 900, reaction.message);

    if (reaction.move && actionable.matches("[data-open-tool],a")) {
      setTimeout(function () {
        if (!state.dragging && state.enabled && Date.now() - state.lastHoverReaction < 1800) {
          moveNearElement(actionable);
        }
      }, 520);
    }
  }

  function pointGazeToElement(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    state.cursorX = rect.left + rect.width / 2;
    state.cursorY = rect.top + rect.height / 2;
    state.gazeStrength = 1.1;
    setTimeout(function () { state.gazeStrength = 1; }, 900);
  }

  function handleClick(event) {
    if (!state.enabled) return;
    const target = event.target instanceof Element ? event.target.closest("a,button,[role=button],[data-open-tool]") : null;
    if (!target || target.closest(".sl-pet-stage,.sl-pet-launcher,.sl-pet-panel")) return;

    markMeaningfulActivity();
    const reaction = inferReaction(target);

    if (target.id === "profileButton") {
      react("curious", 1100, "What name are we getting?");
      setTimeout(function () {
        const input = document.getElementById("profileName");
        if (input) pointGazeToElement(input);
      }, 220);
      return;
    }

    if (reaction.mood === "focused") react("focused", 1050, reaction.message);
    else if (reaction.mood === "excited") react("happy", 900, reaction.message);
    else if (reaction.mood === "concerned") react("confused", 900, reaction.message);
    else react("curious", 820, reaction.message);

    if (target.dataset && target.dataset.openTool === "pomodoro") {
      setTimeout(function () {
        watchStudyToolButtons();
      }, 300);
    }
  }

  function watchStudyToolButtons() {
    document.querySelectorAll("#pomodoroStart,#pomodoroPause,#pomodoroReset,#mockStart,#mockPause,#mockReset").forEach(function (button) {
      if (button.dataset.petBound === "true") return;
      button.dataset.petBound = "true";
      button.addEventListener("click", function () {
        if (!state.enabled) return;
        const id = button.id;
        if (id.endsWith("Start")) react("focused", 1050, id === "pomodoroStart" ? "Focus mode." : "Exam mode.");
        else if (id.endsWith("Pause")) react("confused", 800, "Paused.");
        else react("curious", 800, "Reset.");
      });
    });
  }

  function handleInput(event) {
    if (!state.enabled) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    markMeaningfulActivity();

    if (target.id === "profileName") {
      react("curious", 1200, target.value ? "Interesting name… 👀" : "Who are you?");
      pointGazeToElement(target);
      return;
    }

    if (state.context === "study-tools") {
      react("focused", 700, "");
    }
  }

  function handleKeydown(event) {
    if (!state.enabled) return;
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
      return;
    }
    if (document.activeElement && document.activeElement.id === "profileName") {
      markMeaningfulActivity();
      react("curious", 850, "I'm watching.");
    }
  }

  function handleScroll() {
    if (!state.enabled) return;
    markMeaningfulActivity();
    if (!state.sleeping && Date.now() - state.lastReaction > 1200) {
      react(state.context === "study-tools" ? "focused" : "curious", 600, "");
    }
  }

  function handleVisibility() {
    if (document.hidden) {
      state.sleeping = true;
      setState("sleeping", 0);
      clearTimeout(state.wanderTimer);
    } else if (state.enabled) {
      state.sleeping = false;
      state.lastMeaningfulActivity = Date.now();
      react("curious", 900, "You're back 👀");
      scheduleWander(6000);
      scheduleSleep();
    }
  }

  function syncLauncherPosition() {
    const feedback = document.querySelector(".study-feedback-button");
    if (feedback) {
      const rect = feedback.getBoundingClientRect();
      const right = Math.max(88, window.innerWidth - rect.left + 12);
      launcher.style.right = Math.min(260, right) + "px";
    } else {
      launcher.style.right = window.innerWidth <= 720 ? "94px" : "126px";
    }
  }

  function clampAfterResize() {
    state.position = clampPosition(state.position.x, state.position.y);
    applyPosition(true);
    syncLauncherPosition();
  }

  launcher.addEventListener("click", function () {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  panelClose && panelClose.addEventListener("click", closePanel);
  enableButton && enableButton.addEventListener("click", function () { setEnabled(true); });
  disableButton && disableButton.addEventListener("click", function () { setEnabled(false); });
  eyeButtons.forEach(function (button) {
    button.addEventListener("click", function () { setEye(button.dataset.petEye); });
  });

  character.addEventListener("pointerdown", onPetPointerDown);
  character.addEventListener("pointermove", onPetPointerMove);
  character.addEventListener("pointerup", onPetPointerUp);
  character.addEventListener("pointercancel", onPetPointerUp);
  character.addEventListener("pointerenter", onPetPointerEnter);
  character.addEventListener("pointerleave", onPetPointerLeave);

  document.addEventListener("pointermove", function (event) {
    state.cursorX = event.clientX;
    state.cursorY = event.clientY;
    if (state.sleeping && state.enabled && !state.wakeTimer) {
      state.wakeTimer = setTimeout(function () {
        state.wakeTimer = null;
        wake("Wake up… 👀", "curious");
      }, 850);
    }
    setGaze();
  }, { passive: true });

  document.addEventListener("pointerover", function (event) {
    handleInteractiveHover(event.target);
  }, { passive: true });

  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("scroll", handleScroll, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);

  window.addEventListener("resize", clampAfterResize);

  const profileInput = document.getElementById("profileName");
  if (profileInput) {
    profileInput.addEventListener("focus", function () {
      if (!state.enabled) return;
      markMeaningfulActivity();
      react("curious", 1200, "Who are you? 👀");
      pointGazeToElement(profileInput);
    });
  }

  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", function () {
      if (!state.enabled) return;
      markMeaningfulActivity();
      react("happy", 1050, "Nice to meet you.");
    });
  }

  const profileModal = document.getElementById("profileModal");
  if (profileModal && window.MutationObserver) {
    const observer = new MutationObserver(function () {
      if (profileModal.hidden) return;
      setTimeout(function () {
        const input = document.getElementById("profileName");
        if (input && state.enabled) pointGazeToElement(input);
      }, 120);
    });
    observer.observe(profileModal, { attributes: true, attributeFilter: ["hidden"] });
  }

  watchStudyToolButtons();

  character.dataset.eye = state.eye;
  syncControls();
  syncLauncherPosition();
  applyPosition(true);

  if (!state.enabled) stage.classList.add("is-disabled");
  else {
    stage.classList.remove("is-disabled");
    scheduleWander(5200);
    scheduleSleep();
    setTimeout(function () {
      if (!state.enabled) return;
      react(state.context === "study-tools" ? "curious" : "idle", 900, "");
    }, 1000);
  }

  setInterval(function () {
    if (state.enabled) {
      maybeBlink(Date.now());
      setGaze();
      if (!state.dragging && !state.sleeping && Date.now() - state.lastMeaningfulActivity > 9000 && Math.random() < (state.context === "study-tools" ? 0.24 : 0.12)) {
        react("curious", 720, "");
      }
    }
  }, reducedMotion ? 1800 : 850);

  window.StudyLabPet = {
    getState: function () {
      return {
        enabled: state.enabled,
        eye: state.eye,
        context: state.context,
        sleeping: state.sleeping,
        position: { x: state.position.x, y: state.position.y }
      };
    },
    react: function (mood, message) {
      react(mood || "curious", 900, message || "");
    }
  };
})();
