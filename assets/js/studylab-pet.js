/*
 * StudyLab Living Pet — preview feature
 * Global page-level companion. Intentionally does not integrate with simulations.
 */
(function () {
  "use strict";

  if (window.__StudyLabPetLoaded) return;
  window.__StudyLabPetLoaded = true;

  const STORAGE = { enabled: "studylab-pet-enabled", eye: "studylab-pet-eye" };
  const state = {
    enabled: readBool(STORAGE.enabled, true),
    eye: readEye(),
    mood: "idle",
    sleeping: false,
    busy: false,
    anger: 0,
    lastActivity: Date.now(),
    lastReaction: 0,
    lastHover: 0,
    lastBlink: 0,
    cursorX: window.innerWidth * 0.72,
    cursorY: window.innerHeight * 0.58,
    gazeX: 0,
    gazeY: 0,
    wanderX: 0,
    wanderY: 0,
    pageContext: getPageContext(),
    recentEvents: []
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const style = document.createElement("style");
  style.textContent = "\n.sl-pet-launcher,.sl-pet-panel,.sl-pet-stage{font-family:\"Segoe UI\",\"Noto Sans Sinhala\",Arial,sans-serif}\n.sl-pet-launcher{position:fixed;right:126px;bottom:20px;z-index:980;min-height:42px;padding:9px 13px;display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(13,22,37,.58);color:var(--text-primary,#eef2ff);box-shadow:0 16px 36px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(22px) saturate(155%);-webkit-backdrop-filter:blur(22px) saturate(155%);font:inherit;font-size:.80rem;font-weight:760;cursor:pointer;transition:transform .22s ease,background .22s ease,border-color .22s ease}\n.sl-pet-launcher:hover,.sl-pet-launcher[aria-expanded=\"true\"]{transform:translateY(-2px);background:rgba(24,36,54,.72);border-color:rgba(126,220,255,.25)}\n.sl-pet-launcher:focus-visible,.sl-pet-panel button:focus-visible{outline:2px solid rgba(126,220,255,.60);outline-offset:2px}\n.sl-pet-panel{position:fixed;right:20px;bottom:72px;z-index:981;width:min(330px,calc(100vw - 28px));padding:15px;border:1px solid rgba(255,255,255,.14);border-radius:20px;background:rgba(9,17,30,.77);color:var(--text-primary,#eef2ff);box-shadow:0 28px 78px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(30px) saturate(160%);-webkit-backdrop-filter:blur(30px) saturate(160%)}\n.sl-pet-panel[hidden]{display:none}\n.sl-pet-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}\n.sl-pet-panel-head strong{display:block;font-size:.96rem}\n.sl-pet-panel-head small{display:block;margin-top:2px;color:var(--text-muted,#8fa7c1);font-size:.68rem}\n.sl-pet-panel-close{width:32px;height:32px;border:0;border-radius:10px;background:rgba(255,255,255,.07);color:inherit;cursor:pointer;font:inherit;font-size:1.15rem}\n.sl-pet-setting{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 2px;border-top:1px solid rgba(255,255,255,.07)}\n.sl-pet-setting>span{color:var(--text-secondary,#a9bdd4);font-size:.76rem;font-weight:700}\n.sl-pet-setting-buttons{display:inline-flex;gap:6px}\n.sl-pet-setting-buttons button{min-width:58px;padding:7px 9px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.045);color:inherit;cursor:pointer;font:inherit;font-size:.68rem;font-weight:700}\n.sl-pet-setting-buttons button:hover,.sl-pet-setting-buttons button.is-active{background:rgba(126,220,255,.11);border-color:rgba(126,220,255,.28);color:#8fe7ff}\n.sl-pet-panel-note{margin:11px 2px 2px;color:var(--text-muted,#8fa7c1);font-size:.68rem;line-height:1.5}\n.sl-pet-stage{position:fixed;right:18px;bottom:76px;width:126px;height:96px;z-index:979;pointer-events:none;user-select:none;transition:opacity .35s ease}\n.sl-pet-stage.is-disabled{opacity:0;visibility:hidden}\n.sl-pet-character{position:absolute;left:18px;bottom:10px;width:82px;height:66px;transform:translate3d(0,0,0);transform-origin:50% 60%;background:#020306;border:1px solid rgba(255,255,255,.11);border-radius:18px;box-shadow:0 18px 38px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.06),0 0 24px rgba(126,220,255,.05);pointer-events:auto;cursor:pointer;overflow:hidden;will-change:transform}\n.sl-pet-shadow{position:absolute;left:27px;bottom:2px;width:67px;height:12px;border-radius:999px;background:rgba(0,0,0,.20);filter:blur(5px);transform:scaleX(.90);opacity:.55;transition:transform .45s ease,opacity .45s ease}\n.sl-pet-aura{position:absolute;inset:16px 6px 5px;border-radius:38px;background:radial-gradient(circle at 50% 28%,rgba(126,220,255,.15),transparent 64%);filter:blur(11px);opacity:.75;transition:opacity .4s ease,transform .4s ease}\n.sl-pet-antenna{position:absolute;left:36px;top:0;width:13px;height:20px;border-left:3px solid rgba(214,232,250,.48);transform:rotate(-7deg);transform-origin:50% 100%;z-index:4}\n.sl-pet-antenna:before{content:\"\";position:absolute;left:-6px;top:-4px;width:10px;height:10px;border-radius:50%;background:#77dcff;box-shadow:0 0 13px rgba(119,220,255,.75)}\n.sl-pet-character[data-eye=\"pink\"] .sl-pet-antenna:before{background:#ff83c5;box-shadow:0 0 13px rgba(255,131,197,.74)}\n.sl-pet-ear{position:absolute;top:22px;width:23px;height:23px;border-radius:55% 45% 55% 45%;background:linear-gradient(145deg,rgba(95,148,182,.88),rgba(34,56,80,.95));border:1px solid rgba(255,255,255,.14);z-index:2}\n.sl-pet-ear-left{left:4px;transform:rotate(-28deg)}\n.sl-pet-ear-right{right:4px;transform:rotate(28deg)}\n.sl-pet-body{position:absolute;left:8px;top:17px;width:68px;height:68px;border-radius:42% 42% 38% 38%;background:linear-gradient(150deg,rgba(111,154,187,.98),rgba(42,66,92,.98) 66%,rgba(25,41,61,1));border:1px solid rgba(255,255,255,.17);box-shadow:inset 0 2px 0 rgba(255,255,255,.18),inset 0 -10px 18px rgba(4,15,28,.20),0 12px 30px rgba(0,0,0,.19);overflow:hidden;z-index:3}\n.sl-pet-face{position:absolute;inset:11px 8px 18px}\n.sl-pet-eye{position:absolute;top:7px;width:18px;height:22px;border-radius:48% 48% 52% 52%;background:rgba(12,25,38,.96);border:1px solid rgba(255,255,255,.12);overflow:hidden;transform-origin:50% 70%;transition:transform .12s linear,height .18s ease,top .18s ease}\n.sl-pet-eye-left{left:5px}.sl-pet-eye-right{right:5px}\n.sl-pet-eye i{position:absolute;left:50%;top:50%;width:9px;height:12px;border-radius:50%;transform:translate(-50%,-50%);background:#75e7ff;box-shadow:0 0 10px rgba(117,231,255,.72);transition:transform .12s linear,background .18s ease,box-shadow .18s ease}\n.sl-pet-character[data-eye=\"pink\"] .sl-pet-eye i{background:#ff83c5;box-shadow:0 0 10px rgba(255,131,197,.72)}\n.sl-pet-brow{position:absolute;top:3px;width:16px;height:3px;border-radius:999px;background:rgba(220,237,249,.62);opacity:0;transition:transform .18s ease,opacity .18s ease}\n.sl-pet-brow-left{left:4px}.sl-pet-brow-right{right:4px}\n.sl-pet-mouth{position:absolute;left:50%;bottom:1px;width:15px;height:7px;border-bottom:3px solid rgba(214,233,247,.72);border-radius:0 0 15px 15px;transform:translateX(-50%);transition:transform .18s ease,width .18s ease,height .18s ease,border-radius .18s ease}\n.sl-pet-cheek{position:absolute;bottom:5px;width:7px;height:4px;border-radius:999px;background:rgba(255,120,160,.20);opacity:0;transition:opacity .18s ease}\n.sl-pet-cheek-left{left:1px}.sl-pet-cheek-right{right:1px}\n.sl-pet-chest{position:absolute;left:50%;bottom:7px;width:18px;height:12px;transform:translateX(-50%);border-radius:8px;background:rgba(117,225,255,.12);border:1px solid rgba(117,225,255,.18)}\n.sl-pet-chest span{position:absolute;inset:3px 5px;border-radius:50%;background:rgba(126,220,255,.80);box-shadow:0 0 8px rgba(126,220,255,.55)}\n.sl-pet-foot{position:absolute;top:79px;width:23px;height:13px;border-radius:45% 45% 58% 58%;background:#314b68;border:1px solid rgba(255,255,255,.10);z-index:2}\n.sl-pet-foot-left{left:16px}.sl-pet-foot-right{right:16px}\n\n.sl-pet-shadow,.sl-pet-aura,.sl-pet-antenna,.sl-pet-ear,.sl-pet-foot,.sl-pet-chest,.sl-pet-brow,.sl-pet-mouth,.sl-pet-cheek{display:none!important}\n.sl-pet-character::before{content:"";position:absolute;inset:1px;border-radius:17px;background:radial-gradient(circle at 24% 18%,rgba(255,255,255,.05),transparent 24%),linear-gradient(180deg,rgba(255,255,255,.012),transparent 42%);pointer-events:none}\n.sl-pet-body{position:absolute;inset:0;width:auto;height:auto;border:0;border-radius:0;background:transparent;box-shadow:none;overflow:visible;z-index:1}\n.sl-pet-face{position:absolute;inset:0}\n.sl-pet-eye{top:20px;width:20px;height:26px;border:0;border-radius:6px;background:transparent;overflow:visible;transition:transform .12s cubic-bezier(.2,.8,.2,1),height .18s ease,top .18s ease}\n.sl-pet-eye-left{left:17px}.sl-pet-eye-right{right:17px}\n.sl-pet-eye i{position:absolute;left:50%;top:50%;width:18px;height:24px;border-radius:6px;transform:translate(-50%,-50%);background:#75e7ff;box-shadow:0 0 11px rgba(117,231,255,.72),0 0 22px rgba(117,231,255,.24);transition:transform .12s cubic-bezier(.2,.8,.2,1),background .18s ease,box-shadow .18s ease,width .18s ease,height .18s ease}\n.sl-pet-character[data-eye="pink"] .sl-pet-eye i{background:#ff83c5;box-shadow:0 0 11px rgba(255,131,197,.72),0 0 22px rgba(255,131,197,.24)}\n.sl-pet-character[data-state="curious"] .sl-pet-eye i{width:20px;height:27px}\n.sl-pet-character[data-state="happy"] .sl-pet-eye i{width:19px;height:14px;border-radius:8px 8px 12px 12px}\n.sl-pet-character[data-state="focused"] .sl-pet-eye i{width:17px;height:25px}\n.sl-pet-character[data-state="sleeping"] .sl-pet-eye i{width:20px;height:4px;border-radius:999px;box-shadow:0 0 7px rgba(117,231,255,.28)}\n.sl-pet-character[data-eye="pink"][data-state="sleeping"] .sl-pet-eye i{box-shadow:0 0 7px rgba(255,131,197,.28)}\n.sl-pet-character[data-state="angry"] .sl-pet-eye-left i{transform:translate(-50%,-50%) rotate(17deg);width:21px;height:16px}\n.sl-pet-character[data-state="angry"] .sl-pet-eye-right i{transform:translate(-50%,-50%) rotate(-17deg);width:21px;height:16px}\n.sl-pet-character[data-state="confused"] .sl-pet-eye-left i{transform:translate(-50%,-50%) rotate(-8deg) scaleY(1.1)}\n.sl-pet-character[data-state="confused"] .sl-pet-eye-right i{transform:translate(-50%,-50%) rotate(10deg) scaleY(.88)}\n.sl-pet-bubble{position:absolute;right:0;bottom:103px;min-width:74px;max-width:205px;padding:8px 11px;border:1px solid rgba(255,255,255,.13);border-radius:14px 14px 5px 14px;background:rgba(10,18,31,.72);color:#eaf5ff;box-shadow:0 16px 36px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.065);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);font-size:.69rem;font-weight:700;line-height:1.35;opacity:0;transform:translateY(5px) scale(.97);transition:opacity .22s ease,transform .22s ease}\n.sl-pet-bubble.is-visible{opacity:1;transform:translateY(0) scale(1)}\n.sl-pet-character[data-state=\"happy\"]{animation:slPetHappy .85s cubic-bezier(.2,.8,.2,1)}\n.sl-pet-character[data-state=\"curious\"]{animation:slPetCurious .65s ease}\n.sl-pet-character[data-state=\"confused\"]{animation:slPetConfused .55s ease}\n.sl-pet-character[data-state=\"angry\"]{animation:slPetAngry .48s ease-in-out 0s 2}\n.sl-pet-character[data-state=\"focused\"]{animation:slPetFocused 1.8s ease-in-out infinite}\n.sl-pet-character[data-state=\"sleeping\"]{animation:slPetSleep 3.2s ease-in-out infinite}\n.sl-pet-character[data-state=\"sleeping\"] .sl-pet-eye{top:12px;height:4px;border-radius:999px;transform:rotate(-5deg)}\n.sl-pet-character[data-state=\"sleeping\"] .sl-pet-eye i,.sl-pet-character[data-state=\"sleeping\"] .sl-pet-brow{opacity:0}\n.sl-pet-character[data-state=\"sleeping\"] .sl-pet-mouth{width:11px;height:4px;border-bottom-width:2px;border-radius:50%}\n.sl-pet-character[data-state=\"curious\"] .sl-pet-eye{transform:scaleY(1.08)}\n.sl-pet-character[data-state=\"curious\"] .sl-pet-brow{opacity:.72}\n.sl-pet-character[data-state=\"curious\"] .sl-pet-brow-left{transform:rotate(-9deg) translateY(-2px)}\n.sl-pet-character[data-state=\"curious\"] .sl-pet-brow-right{transform:rotate(9deg) translateY(-2px)}\n.sl-pet-character[data-state=\"happy\"] .sl-pet-mouth{width:19px;height:9px}\n.sl-pet-character[data-state=\"happy\"] .sl-pet-cheek{opacity:.78}\n.sl-pet-character[data-state=\"confused\"] .sl-pet-brow{opacity:.7}\n.sl-pet-character[data-state=\"confused\"] .sl-pet-brow-left{transform:rotate(10deg) translateY(-2px)}\n.sl-pet-character[data-state=\"confused\"] .sl-pet-brow-right{transform:rotate(-7deg) translateY(2px)}\n.sl-pet-character[data-state=\"confused\"] .sl-pet-mouth{width:7px;height:9px;border:0;border-right:2px solid rgba(214,233,247,.72);border-radius:50%}\n.sl-pet-character[data-state=\"angry\"] .sl-pet-brow{opacity:.92}\n.sl-pet-character[data-state=\"angry\"] .sl-pet-brow-left{transform:rotate(18deg) translateY(3px)}\n.sl-pet-character[data-state=\"angry\"] .sl-pet-brow-right{transform:rotate(-18deg) translateY(3px)}\n.sl-pet-character[data-state=\"angry\"] .sl-pet-mouth{width:18px;height:4px;border-bottom:0;border-top:3px solid rgba(214,233,247,.76);border-radius:15px 15px 0 0;transform:translateX(-50%) translateY(3px)}\n@keyframes slPetHappy{0%,100%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) scale(1)}45%{transform:translate3d(var(--pet-x,0px),calc(var(--pet-y,0px) - 8px),0) scale(1.04)}}\n@keyframes slPetCurious{0%,100%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) rotate(0deg)}40%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) rotate(-6deg)}70%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) rotate(4deg)}}\n@keyframes slPetConfused{0%,100%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) rotate(0deg)}30%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) rotate(-7deg)}60%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) rotate(7deg)}}\n@keyframes slPetAngry{0%,100%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) rotate(0deg)}25%{transform:translate3d(calc(var(--pet-x,0px) - 5px),var(--pet-y,0px),0) rotate(-5deg)}75%{transform:translate3d(calc(var(--pet-x,0px) + 5px),var(--pet-y,0px),0) rotate(5deg)}}\n@keyframes slPetFocused{0%,100%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) translateY(0)}50%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) translateY(-2px)}}\n@keyframes slPetSleep{0%,100%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) translateY(0) rotate(0deg)}50%{transform:translate3d(var(--pet-x,0px),var(--pet-y,0px),0) translateY(2px) rotate(-2deg)}}\nhtml[data-theme=\"light\"] .sl-pet-launcher,html[data-theme=\"light\"] .sl-pet-panel,html[data-theme=\"light\"] .sl-pet-bubble{background:rgba(255,255,255,.74);color:#17233a;border-color:rgba(255,255,255,.88);box-shadow:0 22px 58px rgba(35,70,105,.15),inset 0 1px 0 rgba(255,255,255,.96)}\nhtml[data-theme=\"light\"] .sl-pet-panel-note,html[data-theme=\"light\"] .sl-pet-setting>span{color:#607892}\nhtml[data-theme=\"light\"] .sl-pet-setting-buttons button{background:rgba(70,110,145,.05);border-color:rgba(70,110,145,.10)}\n@media(max-width:720px){.sl-pet-launcher{right:94px;bottom:12px;min-height:39px;padding:8px 11px}.sl-pet-panel{right:12px;bottom:60px}.sl-pet-stage{right:10px;bottom:62px;transform:scale(.92);transform-origin:bottom right}}\n@media(prefers-reduced-motion:reduce){.sl-pet-character{animation:none!important}.sl-pet-launcher,.sl-pet-panel,.sl-pet-bubble{transition:none!important}}\n";
  document.head.appendChild(style);
  document.body.insertAdjacentHTML("beforeend", "\n    <button class=\"sl-pet-launcher\" type=\"button\" aria-expanded=\"false\" aria-controls=\"slPetPanel\" title=\"StudyLab Pet controls\">\n      <span aria-hidden=\"true\">🐾</span><span>Pet</span>\n    </button>\n\n    <aside class=\"sl-pet-panel\" id=\"slPetPanel\" hidden aria-label=\"StudyLab Pet controls\">\n      <div class=\"sl-pet-panel-head\">\n        <div><strong>StudyLab Pet</strong><small>Your little study companion</small></div>\n        <button class=\"sl-pet-panel-close\" type=\"button\" aria-label=\"Close pet controls\">×</button>\n      </div>\n\n      <div class=\"sl-pet-setting\">\n        <span>Pet</span>\n        <div class=\"sl-pet-setting-buttons\" role=\"group\" aria-label=\"Pet enabled state\">\n          <button type=\"button\" data-pet-enable>Enable</button>\n          <button type=\"button\" data-pet-disable>Disable</button>\n        </div>\n      </div>\n\n      <div class=\"sl-pet-setting\">\n        <span>Eye colour</span>\n        <div class=\"sl-pet-setting-buttons\" role=\"group\" aria-label=\"Pet eye colour\">\n          <button type=\"button\" data-pet-eye=\"cyan\">Cyan</button>\n          <button type=\"button\" data-pet-eye=\"pink\">Pink</button>\n        </div>\n      </div>\n\n      <p class=\"sl-pet-panel-note\">It watches the page, follows your cursor, naps when you're idle, and reacts to different StudyLab areas.</p>\n    </aside>\n\n    <div class=\"sl-pet-stage\" aria-hidden=\"true\">\n      <div class=\"sl-pet-shadow\"></div>\n      <div class=\"sl-pet-character\" data-state=\"idle\" data-eye=\"cyan\" role=\"button\" tabindex=\"-1\">\n        <div class=\"sl-pet-aura\"></div>\n        <div class=\"sl-pet-antenna\"><i></i></div>\n        <div class=\"sl-pet-ear sl-pet-ear-left\"></div>\n        <div class=\"sl-pet-ear sl-pet-ear-right\"></div>\n        <div class=\"sl-pet-body\">\n          <div class=\"sl-pet-face\">\n            <div class=\"sl-pet-brow sl-pet-brow-left\"></div>\n            <div class=\"sl-pet-brow sl-pet-brow-right\"></div>\n            <div class=\"sl-pet-eye sl-pet-eye-left\"><i></i></div>\n            <div class=\"sl-pet-eye sl-pet-eye-right\"><i></i></div>\n            <div class=\"sl-pet-mouth\"></div>\n            <div class=\"sl-pet-cheek sl-pet-cheek-left\"></div>\n            <div class=\"sl-pet-cheek sl-pet-cheek-right\"></div>\n          </div>\n          <div class=\"sl-pet-chest\"><span></span></div>\n        </div>\n        <div class=\"sl-pet-foot sl-pet-foot-left\"></div>\n        <div class=\"sl-pet-foot sl-pet-foot-right\"></div>\n      </div>\n      <div class=\"sl-pet-bubble\" data-pet-bubble role=\"status\" aria-live=\"polite\"></div>\n    </div>\n");

  const launcher = document.querySelector(".sl-pet-launcher");
  const panel = document.querySelector(".sl-pet-panel");
  const panelClose = document.querySelector(".sl-pet-panel-close");
  const stage = document.querySelector(".sl-pet-stage");
  const character = document.querySelector(".sl-pet-character");
  const shadow = document.querySelector(".sl-pet-shadow");
  const bubble = document.querySelector("[data-pet-bubble]");
  const eyes = Array.from(document.querySelectorAll(".sl-pet-eye i"));
  const eyeShells = Array.from(document.querySelectorAll(".sl-pet-eye"));
  const enableButton = document.querySelector("[data-pet-enable]");
  const disableButton = document.querySelector("[data-pet-disable]");
  const eyeButtons = Array.from(document.querySelectorAll("[data-pet-eye]"));

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

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE.enabled, String(state.enabled));
      localStorage.setItem(STORAGE.eye, state.eye);
    } catch (_) {}
  }

  function getPageContext() {
    const path = location.pathname.toLowerCase();
    const title = document.title.toLowerCase();
    const text = (document.body && document.body.innerText || "").slice(0, 5000).toLowerCase();

    if (path.includes("study-tools")) return "study";
    if (path.includes("physics")) return "physics";
    if (path.includes("chemistry")) return "chemistry";
    if (path.includes("maths")) return "maths";
    if (path.includes("biology")) return "biology";
    if (path.includes("exam-hub") || /past papers|marking scheme/.test(text)) return "exam";
    if (path.includes("telegram")) return "social";
    if (/physics/.test(title + text)) return "physics";
    if (/chemistry/.test(title + text)) return "chemistry";
    if (/mathematics|maths/.test(title + text)) return "maths";
    if (/biology/.test(title + text)) return "biology";
    return "home";
  }

  function contextBaseMood() {
    if (state.sleeping) return "sleeping";
    if (state.pageContext === "study" || state.pageContext === "exam") return "focused";
    return "idle";
  }

  function updateControls() {
    stage.classList.toggle("is-disabled", !state.enabled);
    character.dataset.eye = state.eye;
    enableButton.classList.toggle("is-active", state.enabled);
    disableButton.classList.toggle("is-active", !state.enabled);
    eyeButtons.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });
  }

  function openPanel(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
  }

  function showMessage(text, duration) {
    if (!state.enabled) return;
    bubble.textContent = text;
    bubble.classList.add("is-visible");
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(hideMessage, duration || 2200);
  }

  function hideMessage() {
    bubble.classList.remove("is-visible");
  }

  function setMood(mood, ttl) {
    if (!state.enabled) return;
    state.mood = mood;
    character.dataset.state = state.sleeping ? "sleeping" : mood;
    clearTimeout(setMood.timer);
    if (ttl !== 0) {
      setMood.timer = setTimeout(function () {
        if (!state.sleeping) {
          state.mood = contextBaseMood();
          character.dataset.state = state.mood;
        }
      }, ttl || 1200);
    }
  }

  function rememberEvent(type) {
    state.recentEvents.push({ type: type, at: Date.now() });
    state.recentEvents = state.recentEvents.filter(function (item) {
      return Date.now() - item.at < 16000;
    });
  }

  function wasRecent(type, within) {
    return state.recentEvents.some(function (item) {
      return item.type === type && Date.now() - item.at <= (within || 1500);
    });
  }

  function chooseWander() {
    if (!state.enabled || state.sleeping || state.busy) return;
    state.wanderX = Math.random() * 28 - 14;
    state.wanderY = Math.random() * 10 - 5;
    character.style.setProperty("--pet-x", state.wanderX + "px");
    character.style.setProperty("--pet-y", state.wanderY + "px");
    shadow.style.transform = "translateX(" + (state.wanderX * 0.55) + "px) scaleX(" + (0.88 + Math.abs(state.wanderX) * 0.008) + ")";
  }

  function blink() {
    if (!state.enabled || state.sleeping) return;
    state.lastBlink = Date.now();
    eyeShells.forEach(function (eye) {
      eye.style.height = "4px";
      eye.style.top = "12px";
    });
    setTimeout(function () {
      if (state.sleeping) return;
      eyeShells.forEach(function (eye) {
        eye.style.height = "";
        eye.style.top = "";
      });
    }, 145);
  }

  function setGazeFromPointer(x, y) {
    state.cursorX = x;
    state.cursorY = y;

    const rect = stage.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.52;
    const centerY = rect.top + rect.height * 0.52;
    const dx = Math.max(-1, Math.min(1, (x - centerX) / 190));
    const dy = Math.max(-1, Math.min(1, (y - centerY) / 150));

    state.gazeX += (dx * 5.5 - state.gazeX) * 0.18;
    state.gazeY += (dy * 4.7 - state.gazeY) * 0.18;

    eyes.forEach(function (eye) {
      eye.style.transform = "translate(calc(-50% + " + state.gazeX + "px), calc(-50% + " + state.gazeY + "px))";
    });
  }

  function setEnabled(enabled) {
    state.enabled = enabled;
    state.sleeping = false;
    if (enabled) {
      state.lastActivity = Date.now();
      updateControls();
      react("wake", { force: true });
      showMessage("I'm back. 👀", 1500);
    } else {
      hideMessage();
      state.mood = "idle";
      character.dataset.state = "idle";
      updateControls();
    }
    savePrefs();
  }

  function setEye(eye) {
    state.eye = eye === "pink" ? "pink" : "cyan";
    updateControls();
    savePrefs();
    if (state.enabled) {
      setMood("happy", 850);
      showMessage(state.eye === "pink" ? "Pink mode. 🩷" : "Cyan mode. 🩵", 1400);
    }
  }

  function react(type, detail) {
    detail = detail || {};
    if (!state.enabled && !detail.force) return;

    rememberEvent(type);
    const now = Date.now();
    if (!detail.force && now - state.lastReaction < 160) return;
    state.lastReaction = now;
    state.lastActivity = now;
    state.sleeping = false;

    if (type === "wake") {
      setMood("curious", 900);
      showMessage("I'm awake 👀", 1600);
    } else if (type === "cursor-near") {
      setMood("curious", 650);
    } else if (type === "scroll") {
      setMood("curious", 500);
    } else if (type === "hover-card") {
      const c = detail.context || "home";
      const map = {
        physics: ["Physics detected 👀", "That looks interesting.", "Watching the Physics section."],
        chemistry: ["Chemistry? 🧪", "Lab mode: curious.", "Something is reacting..."],
        maths: ["Maths time. 📐", "Keeping an eye on that.", "Numbers. Humanity chose numbers."],
        biology: ["Biology! 🧬", "Curious about this one.", "Observing..."],
        study: ["Study mode activated.", "Focus. I approve.", "I'm watching the timer."],
        exam: ["Exam territory.", "Paper hunt detected.", "Serious mode."],
        social: ["Student community 👀", "Telegram territory.", "I see where you're going."]
      };
      const pool = map[c] || ["Hmm...", "I noticed that.", "Interesting..."];
      showMessage(pool[Math.floor(Math.random() * pool.length)], 2100);
      setMood(c === "exam" || c === "study" ? "focused" : "curious", 1150);
    } else if (type === "click-card") {
      const c = detail.context || "home";
      if (c === "study") {
        setMood("focused", 1500);
        showMessage("Study tools. Let's work.", 2100);
      } else if (c === "chemistry") {
        setMood("happy", 1200);
        showMessage("🧪 Reaction!", 1600);
      } else if (c === "physics") {
        setMood("happy", 1200);
        showMessage("Physics engaged ⚛️", 1700);
      } else if (c === "maths") {
        setMood("curious", 1200);
        showMessage("Calculating...", 1600);
      } else if (c === "biology") {
        setMood("happy", 1000);
        showMessage("Biology mode. 🧬", 1700);
      } else if (c === "exam") {
        setMood("focused", 1500);
        showMessage("Locking in.", 1600);
      } else {
        setMood("happy", 1000);
      }
    } else if (type === "typing") {
      setMood("curious", 850);
      showMessage(detail.name ? "That name got my attention. 👀" : "What are you typing?", 1600);
    } else if (type === "name-complete") {
      setMood("happy", 1200);
      showMessage(detail.name ? "Nice to meet you, " + detail.name + "." : "I saw that.", 2100);
    } else if (type === "tool") {
      setMood("focused", 1700);
      showMessage("Tool opened. I'm watching. 👀", 1800);
    } else if (type === "pomodoro") {
      setMood("focused", 3000);
      showMessage("Focus mode. No excuses.", 2100);
    } else if (type === "flashcard") {
      setMood("curious", 1100);
      showMessage("Flip it.", 1200);
    } else if (type === "mistake") {
      setMood("confused", 1200);
      showMessage("Good. Fixing mistakes upgrades the brain.", 2300);
    } else if (type === "theme") {
      setMood("curious", 800);
      showMessage("New lighting.", 1100);
    } else if (type === "anger") {
      state.anger += 1;
      setMood("angry", 1200);
      if (state.anger === 1) showMessage("Hey. Easy.", 1500);
      else if (state.anger === 2) showMessage("Stop poking me. 😑", 1700);
      else if (state.anger === 3) showMessage("I was sleeping, you know.", 1900);
      else showMessage("I'm ignoring you for a moment.", 2100);
    }
  }

  function pageCardContext(el) {
    const value = (
      (el.getAttribute("href") || "") + " " +
      (el.textContent || "") + " " +
      (el.getAttribute("aria-label") || "") + " " +
      (el.className || "")
    ).toLowerCase();

    if (/study tools|study utilities|pomodoro|flashcard|mistake|planner|converter/.test(value)) return "study";
    if (/physics|විද්‍යුත|චුම්බක|තරංග|mechanics|doppler/.test(value)) return "physics";
    if (/chemistry|රසායන|organic|inorganic|practical/.test(value)) return "chemistry";
    if (/mathematics|combined maths|combined mathematics|සංයුක්ත ගණිතය|trigonometry|calculus|vector/.test(value)) return "maths";
    if (/biology|ජීව|genetics|cell structure/.test(value)) return "biology";
    if (/exam|past paper|marking|model paper|school paper|admission|timetable/.test(value)) return "exam";
    if (/telegram|community|channel/.test(value)) return "social";
    return state.pageContext;
  }

  function handlePointerMove(event) {
    if (!state.enabled) return;
    setGazeFromPointer(event.clientX, event.clientY);
    if (state.sleeping) react("wake", { force: true });
    state.lastActivity = Date.now();

    const rect = stage.getBoundingClientRect();
    const distance = Math.hypot(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2)
    );

    if (distance < 70 && Date.now() - state.lastReaction > 1000) {
      react("cursor-near");
      chooseWander();
    }
  }

  function handlePointerOver(event) {
    if (!state.enabled) return;
    const card = event.target.closest && event.target.closest(".utility-card,.subject-card,.study-tools-card,.telegram-card,.examhub-card,.live-card");
    if (card && !card.contains(event.relatedTarget) && Date.now() - state.lastHover > 700) {
      state.lastHover = Date.now();
      react("hover-card", { context: pageCardContext(card) });
    }
  }

  function handleClicks(event) {
    if (!state.enabled) return;
    const target = event.target.closest && event.target.closest("a,button,[role='button']");
    if (!target || stage.contains(target) || panel.contains(target) || launcher.contains(target)) return;

    const id = target.id || "";
    const context = pageCardContext(target);
    if (id === "pomodoroStart") return react("pomodoro");
    if (/flashcard/i.test(id)) return react("flashcard");
    if (/mistake/i.test(id)) return react("mistake");
    if (target.matches(".utility-card,.subject-card,.study-tools-card,.telegram-card,.examhub-card,.live-card")) {
      react("click-card", { context: context });
    }
  }

  function handleTyping(event) {
    if (!state.enabled) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;

    state.lastActivity = Date.now();
    const value = (target.value || "").trim();

    if (target.id === "profileName" || target.name === "name") {
      react("typing", { name: value });
      clearTimeout(handleTyping.nameTimer);
      if (value.length >= 2) {
        handleTyping.nameTimer = setTimeout(function () {
          if (String(target.value || "").trim() === value) react("name-complete", { name: value });
        }, 900);
      }
      return;
    }

    if (Date.now() - state.lastReaction > 900) react("typing");
  }

  function observeDynamicPanels() {
    const seen = new WeakSet();
    const observer = new MutationObserver(function () {
      if (!state.enabled) return;
      const visiblePanels = Array.from(document.querySelectorAll(".tool-panel.is-open,.studylab-ai-panel:not([hidden]),.study-quick-panel:not([hidden])"));
      visiblePanels.forEach(function (panelEl) {
        if (seen.has(panelEl)) return;
        seen.add(panelEl);
        const id = panelEl.id || "";
        if (/pomodoro/i.test(id)) react("pomodoro");
        else if (/flash/i.test(id)) react("flashcard");
        else if (/mistake/i.test(id)) react("mistake");
        else react("tool");
      });
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  }

  function updateActivity() {
    if (!state.enabled) return;
    const idleMs = Date.now() - state.lastActivity;

    if (document.hidden) return;

    if (idleMs > 22000 && !state.sleeping) {
      state.sleeping = true;
      state.mood = "sleeping";
      character.dataset.state = "sleeping";
      showMessage("Zzz...", 1800);
      return;
    }

    if (state.sleeping) return;

    if (state.pageContext === "study" && idleMs > 7000) {
      setMood("focused", 0);
    }

    if (idleMs > 3000 && !state.busy && Math.random() < 0.14) chooseWander();
  }

  function ambientLoop() {
    if (state.enabled && !state.sleeping && !reducedMotion) {
      const now = Date.now();

      if (now - state.lastBlink > 3600 && Math.random() < 0.035) blink();
      if (now - state.lastActivity > 4200 && Math.random() < 0.07) chooseWander();

      if (Math.random() < 0.004 && !bubble.classList.contains("is-visible")) {
        const ambient = {
          home: ["Hmm... 👀", "I'm watching.", "Carry on."],
          physics: ["Watching the motion.", "Physics makes everything move."],
          chemistry: ["Waiting for a reaction..."],
          maths: ["Numbers again. Respect."],
          biology: ["Observing quietly. 🧬"],
          study: ["Still studying? Good.", "Focus looks good.", "I'm keeping watch."],
          exam: ["Keep it calm.", "One paper at a time."],
          social: ["Student community detected."]
        };
        const pool = ambient[state.pageContext] || ambient.home;
        showMessage(pool[Math.floor(Math.random() * pool.length)], 1900);
      }
    }
    requestAnimationFrame(ambientLoop);
  }

  function wake() {
    if (!state.enabled) return;
    state.sleeping = false;
    state.lastActivity = Date.now();
    setMood("curious", 900);
  }

  launcher.addEventListener("click", function (event) {
    event.stopPropagation();
    openPanel(panel.hidden);
  });

  panelClose.addEventListener("click", function () { openPanel(false); });
  enableButton.addEventListener("click", function () { setEnabled(true); });
  disableButton.addEventListener("click", function () { setEnabled(false); });
  eyeButtons.forEach(function (button) {
    button.addEventListener("click", function () { setEye(button.dataset.petEye); });
  });

  character.addEventListener("click", function (event) {
    event.stopPropagation();
    if (!state.enabled) return;
    react("anger", { force: true });
  });

  document.addEventListener("click", function (event) {
    if (!panel.hidden && !panel.contains(event.target) && !launcher.contains(event.target)) openPanel(false);
  });

  document.addEventListener("mousemove", handlePointerMove, { passive: true });
  document.addEventListener("pointerover", handlePointerOver, { passive: true });
  document.addEventListener("click", handleClicks, true);
  document.addEventListener("input", handleTyping, { passive: true });
  document.addEventListener("focusin", function (event) {
    if (!state.enabled) return;
    if (event.target.matches && event.target.matches("input,textarea,select")) react("typing");
  });
  document.addEventListener("scroll", function () {
    if (!state.enabled) return;
    state.lastActivity = Date.now();
    if (Date.now() - state.lastReaction > 1300) react("scroll");
  }, { passive: true });

  document.addEventListener("keydown", function (event) {
    if (!state.enabled) return;
    state.lastActivity = Date.now();
    if (event.key === "Escape") openPanel(false);
    else if (event.key.length === 1 || event.key === "Backspace") {
      if (!wasRecent("typing", 1000)) react("typing");
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (!state.enabled) return;
    if (document.hidden) {
      state.sleeping = true;
      character.dataset.state = "sleeping";
      hideMessage();
    } else {
      wake();
      react("wake", { force: true });
    }
  });

  window.addEventListener("studylab-profile-updated", function (event) {
    const name = event.detail && event.detail.display_name || "";
    if (state.enabled && name) react("name-complete", { name: name });
  });

  const themeButton = document.querySelector("[data-theme-toggle]");
  if (themeButton) themeButton.addEventListener("click", function () { react("theme"); });

  updateControls();
  setGazeFromPointer(state.cursorX, state.cursorY);
  state.lastActivity = Date.now();

  if (state.enabled) {
    setTimeout(function () { react("wake", { force: true }); }, 850);
  } else {
    character.dataset.state = "idle";
  }

  setInterval(updateActivity, 1000);
  setInterval(function () {
    if (state.anger > 0 && Date.now() - state.lastReaction > 6500) state.anger = Math.max(0, state.anger - 1);
  }, 2000);

  observeDynamicPanels();
  ambientLoop();
})();
