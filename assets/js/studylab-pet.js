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
    mode: "studylab-pet-mode",
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
    mode: read(KEY.mode, "natural"),
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
    hoverTimer: null,
    lastHoveredElement: null,
    nameMessageShown: false
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
      '<div class="sl-pet-setting sl-pet-mode-setting"><span>Personality</span><div class="sl-pet-mode-grid">' +
        '<button type="button" data-pet-mode="natural">Natural</button>' +
        '<button type="button" data-pet-mode="playful">Playful</button>' +
        '<button type="button" data-pet-mode="strict">Strict</button>' +
        '<button type="button" data-pet-mode="lazy">Lazy</button>' +
        '<button type="button" data-pet-mode="focused">Focused</button>' +
        '<button type="button" data-pet-mode="curious">Curious</button>' +
        '<button type="button" data-pet-mode="energetic">Energetic</button>' +
        '<button type="button" data-pet-mode="observer">Observer</button>' +
        '<button type="button" data-pet-mode="social">Social</button>' +
        '<button type="button" data-pet-mode="sleepy">Sleepy</button>' +
        '<button type="button" data-pet-mode="exam">Exam Mode</button>' +
        '<button type="button" class="is-featured" data-pet-mode="all-in-one">All In One</button>' +
      '</div></div>' +
      '<p class="sl-pet-panel-note">Each personality changes movement, attention, sleep, expressions and reactions. Messages stay tied to what you do.</p>' +
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
  const modeButtons = [...panel.querySelectorAll("[data-pet-mode]")];

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
    const cloudWidth = window.innerWidth <= 720 ? 82 : 90;
    const petHalfHeight = window.innerWidth <= 720 ? 32 : 35;
    const rightShift = window.innerWidth <= 720 ? 5 : 7;
    const anchorX = clamp(
      state.x - cloudWidth / 2 + rightShift,
      8,
      Math.max(8, window.innerWidth - cloudWidth - 8)
    );
    thought.style.left = anchorX + "px";
    thought.style.top = Math.max(54, state.y - petHalfHeight - 2) + "px";
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

  const contextHoverFallback = {
    home:"Choose what to study.",
    physics:"Physics: observe, calculate, check.",
    chemistry:"Chemistry: observe, balance, check.",
    maths:"Maths: plan, solve, verify.",
    biology:"Biology: observe structure and function.",
    study:"Choose the next study task.",
    exam:"Read carefully and watch time.",
    social:"Study resources and updates."
  };

  const contextActionFallback = {
    home:"Opening this StudyLab item.",
    physics:"Opening physics work.",
    chemistry:"Opening chemistry work.",
    maths:"Opening maths work.",
    biology:"Opening biology work.",
    study:"Opening this study tool.",
    exam:"Opening exam material.",
    social:"Opening community resources."
  };

  const modeProfiles = {
    natural:{label:"Natural",moveScale:1.00,minMove:300,wanderWait:[13000,22000],initialWait:[9000,15000],sleepAfter:32000,cardBias:.38,hoverDelay:120,expressionMoods:null,angerDuration:[4200,6200]},
    playful:{label:"Playful",moveScale:.90,minMove:285,wanderWait:[8500,15000],initialWait:[6500,11000],sleepAfter:42000,cardBias:.58,hoverDelay:90,expressionMoods:["happy","excited","curious","surprised"],angerDuration:[3500,5000]},
    strict:{label:"Strict",moveScale:1.12,minMove:340,wanderWait:[18000,29000],initialWait:[13000,21000],sleepAfter:44000,cardBias:.22,hoverDelay:160,expressionMoods:["focused","alert","suspicious","worried"],angerDuration:[5200,7200]},
    lazy:{label:"Lazy",moveScale:1.18,minMove:330,wanderWait:[26000,44000],initialWait:[20000,32000],sleepAfter:19000,cardBias:.12,hoverDelay:260,expressionMoods:["bored","sleeping","neutral","shy"],angerDuration:[2800,4300]},
    focused:{label:"Focused",moveScale:1.05,minMove:320,wanderWait:[10500,18500],initialWait:[7500,12000],sleepAfter:43000,cardBias:.72,hoverDelay:100,expressionMoods:["focused","thinking","alert"],angerDuration:[4500,6500]},
    curious:{label:"Curious",moveScale:.94,minMove:300,wanderWait:[8000,14500],initialWait:[6000,10000],sleepAfter:40000,cardBias:.82,hoverDelay:80,expressionMoods:["curious","surprised","thinking","delighted"],angerDuration:[3800,5400]},
    energetic:{label:"Energetic",moveScale:.82,minMove:310,wanderWait:[6500,12000],initialWait:[5000,8500],sleepAfter:50000,cardBias:.62,hoverDelay:70,expressionMoods:["excited","happy","alert","curious"],angerDuration:[3800,5600]},
    observer:{label:"Observer",moveScale:1.16,minMove:360,wanderWait:[28000,46000],initialWait:[17000,30000],sleepAfter:36000,cardBias:.80,hoverDelay:240,expressionMoods:["curious","focused","neutral","suspicious"],angerDuration:[3600,5200]},
    social:{label:"Social",moveScale:.96,minMove:300,wanderWait:[10000,18000],initialWait:[7000,12000],sleepAfter:46000,cardBias:.65,hoverDelay:100,expressionMoods:["happy","delighted","curious","excited"],angerDuration:[3600,5200]},
    sleepy:{label:"Sleepy",moveScale:1.28,minMove:350,wanderWait:[30000,52000],initialWait:[24000,38000],sleepAfter:15000,cardBias:.08,hoverDelay:300,expressionMoods:["sleeping","bored","shy","neutral"],angerDuration:[3000,4500]},
    exam:{label:"Exam Mode",moveScale:1.12,minMove:345,wanderWait:[18000,30000],initialWait:[12000,20000],sleepAfter:52000,cardBias:.48,hoverDelay:140,expressionMoods:["alert","focused","worried","thinking"],angerDuration:[5200,7200]},
    "all-in-one":{label:"All In One",moveScale:.88,minMove:300,wanderWait:[7500,14500],initialWait:[5500,9500],sleepAfter:48000,cardBias:.78,hoverDelay:75,expressionMoods:null,angerDuration:[4600,6800]}
  };

  if (!modeProfiles[state.mode]) state.mode="natural";

  const semanticRules = [
    {re:/pomodoro|focus timer/,expression:"focused",hover:"Focus, work, break.",action:"Starting a focus session."},
    {re:/flashcard|flash card/,expression:"curious",hover:"Recall before reveal.",action:"Opening flashcard practice."},
    {re:/mistake|mistakes|error notebook/,expression:"worried",hover:"Find the pattern.",action:"Reviewing mistakes."},
    {re:/planner|study plan/,expression:"thinking",hover:"Plan the next task.",action:"Planning the study session."},
    {re:/marks|marks calculator|calculator|calculat/,expression:"thinking",hover:"Check before targeting.",action:"Calculating the marks."},
    {re:/mock exam|exam timer|quiz/,expression:"alert",hover:"Time + accuracy.",action:"Starting mock-exam work."},
    {re:/converter|convert/,expression:"curious",hover:"Convert, then verify.",action:"Converting units."},
    {re:/doppler/,expression:"excited",hover:"Relative motion → frequency.",action:"Studying the Doppler effect."},
    {re:/gravity|gravitation/,expression:"focused",hover:"Masses attract each other.",action:"Exploring gravity."},
    {re:/newton|force|motion|kinematic|mechanic/,expression:"alert",hover:"Forces change motion.",action:"Working on mechanics."},
    {re:/wave|oscillation|shm|simple harmonic/,expression:"focused",hover:"Amplitude • frequency • phase.",action:"Studying wave motion."},
    {re:/electric|circuit|current|voltage|resistor/,expression:"alert",hover:"Current • voltage • resistance.",action:"Working on electricity."},
    {re:/physics/,expression:"focused",hover:"Force • motion • energy.",action:"Opening physics work."},
    {re:/titration|titrate|endpoint|end point/,expression:"focused",hover:"Watch the endpoint.",action:"Working on titration."},
    {re:/reaction|chemical|organic|inorganic|mole|stoichiometr/,expression:"curious",hover:"Particles • bonds • reactions.",action:"Working on chemistry."},
    {re:/practical|laboratory|lab/,expression:"delighted",hover:"Observe before concluding.",action:"Starting practical work."},
    {re:/chemistry/,expression:"curious",hover:"Particles • bonds • reactions.",action:"Opening chemistry work."},
    {re:/trigonometry|sine|cosine|tan/,expression:"thinking",hover:"Check signs and quadrants.",action:"Working on trigonometry."},
    {re:/calculus|derivative|integral|differential/,expression:"focused",hover:"Define the variable first.",action:"Working on calculus."},
    {re:/vector|vectors/,expression:"thinking",hover:"Magnitude + direction.",action:"Working on vectors."},
    {re:/equation|algebra|polynomial/,expression:"thinking",hover:"Isolate x, then check.",action:"Working on algebra."},
    {re:/maths|mathematics/,expression:"thinking",hover:"Plan • solve • verify.",action:"Opening maths work."},
    {re:/genetics|gene|dna|chromosome/,expression:"curious",hover:"Genes carry information.",action:"Exploring genetics."},
    {re:/cell|organelle|mitosis|meiosis/,expression:"focused",hover:"Structure and function.",action:"Studying cells."},
    {re:/ecology|ecosystem|food chain/,expression:"alert",hover:"Watch system interactions.",action:"Exploring ecology."},
    {re:/biology|organism/,expression:"curious",hover:"Structure • function • systems.",action:"Opening biology work."},
    {re:/past paper|marking scheme|model paper|school paper/,expression:"focused",hover:"Spot repeated patterns.",action:"Opening exam material."},
    {re:/exam hub|exam/,expression:"alert",hover:"Read carefully. Watch time.",action:"Opening exam work."},
    {re:/simulation|simulat|interactive/,expression:"excited",hover:"Change one variable.",action:"Opening an interactive simulation."},
    {re:/telegram|community|channel/,expression:"happy",hover:"Study resources live here.",action:"Opening community resources."},
    {re:/search/,expression:"curious",hover:"Narrow the search term.",action:"Using StudyLab search."},
    {re:/profile|account|name/,expression:"curious",hover:"Your StudyLab identity.",action:"Editing your profile."},
    {re:/theme|dark mode|light mode/,expression:"surprised",hover:"New view, same StudyLab.",action:"Changing the theme."},
    {re:/save|favorite|favourite|bookmark/,expression:"happy",hover:"Keep this for later.",action:"Saving this resource."},
    {re:/download|pdf/,expression:"focused",hover:"Ready for the PDF.",action:"Downloading study material."},
    {re:/open|view/,expression:"focused",hover:"Open it and start.",action:"Opening the material."},
    {re:/delete|remove|reset|clear/,expression:"worried",hover:"Careful: data may clear.",action:"Editing or clearing this item."},
    {re:/submit|finish|complete|start/,expression:"alert",hover:"Ready for the next step.",action:"Moving to the next step."}
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

  function infoFor(el, type = "hover") {
    const text = descriptor(el);
    const matched = semanticRules.find((item) => item.re.test(text));
    const context = contextFromElement(el) || state.context;
    const fallback = type === "click"
      ? (contextActionFallback[context] || "Opening this StudyLab item.")
      : (contextHoverFallback[context] || "Choose the next study task.");

    return {
      expression: matched ? matched.expression : pick(contextMoods[context] || ["neutral"]),
      thought: matched ? (type === "click" ? matched.action : matched.hover) : fallback
    };
  }

  function modeProfile() {
    return modeProfiles[state.mode] || modeProfiles.natural;
  }

  function modeExpression(base) {
    const profile = modeProfile();
    return profile.expressionMoods?.length ? pick(profile.expressionMoods) : personaVariation(base);
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
    if (time - state.lastReaction < (type === "hover" ? 500 : 350)) return;

    state.lastReaction = time;
    state.lastActivity = time;
    state.lastMeaningfulActivity = time;
    wake("pointer");

    const info = infoFor(el, type);
    const expression = modeExpression(info.expression || "neutral");
    setExpression(expression, type === "hover" ? 1250 : 1550);
    showThought(info.thought, type === "hover" ? 1450 : 1500);
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

  function minimumWalkDistance() {
    const profile = modeProfile();
    const possible = Math.hypot(
      Math.max(0, window.innerWidth - 120),
      Math.max(0, window.innerHeight - 210)
    );
    return Math.min(
      profile.minMove,
      Math.max(220, possible * 0.55)
    );
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

    if (distance < minimumWalkDistance()) return;

    const direction = visualDirection(dx, dy);
    const duration = reason === "evade"
      ? walkingDuration(distance, direction, reason)
      : clamp(walkingDuration(distance, direction, reason) * modeProfile().moveScale * 1.40, 3200, 7000);
    const started = now();
    const token = state.moveToken;

    character.dataset.moving = "true";
    character.dataset.direction = direction;

    if (reason === "evade") {
      setExpression("angry", 900, true);
    } else if (direction === "up") {
      setExpression(modeExpression("focused"), 1150);
    } else if (direction === "down") {
      setExpression(modeExpression("alert"), 900);
    } else {
      setExpression(modeExpression("neutral"), 1000);
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
          state.nextWander = now() + rand(
            modeProfile().wanderWait[0],
            modeProfile().wanderWait[1]
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
    const profile = modeProfile();
    const minDistance = minimumWalkDistance();
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

    let bestPoint = null;
    let bestDistance = -1;

    for (let attempt = 0; attempt < 24; attempt++) {
      const point = candidates.length && Math.random() < profile.cardBias
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

      const distance = Math.hypot(point.x - state.x, point.y - state.y);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestPoint = point;
      }
      if (distance >= minDistance) return point;
    }

    return bestPoint || randomSafePoint();
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
    const profile = modeProfile();
    state.angerUntil = now() + rand(profile.angerDuration[0], profile.angerDuration[1]);
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

    trackHoverTarget();

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

  function trackHoverTarget() {
    const target = nearestInteractive(
      document.elementFromPoint(
        clamp(state.pointerX, 1, window.innerWidth - 1),
        clamp(state.pointerY, 1, window.innerHeight - 1)
      )
    );

    if (target === state.lastHoveredElement) return;

    clearTimeout(state.hoverTimer);
    state.lastHoveredElement = target;

    if (!target || target === character || character.contains(target) ||
        target === launcher || panel.contains(target)) return;

    const delay = modeProfile().hoverDelay;
    state.hoverTimer = setTimeout(() => {
      if (state.enabled && target === state.lastHoveredElement &&
          !state.dragging && !state.sleeping) {
        reactToElement(target, "hover");
      }
    }, delay);
  }

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

    if (isName) {
      setExpression("curious", 850);
      if (!value) {
        state.nameMessageShown = false;
      } else if (!state.nameMessageShown) {
        state.nameMessageShown = true;
        showThought(value.length >= 2 ? "Profile name set." : "Typing your name.", 1050);
      }
    } else if (value) {
      setExpression("focused", 650);
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

  function setMode(mode) {
    state.mode = modeProfiles[mode] ? mode : "natural";
    save(KEY.mode, state.mode);
    character.dataset.mode = state.mode;
    state.nextWander = now() + rand(
      modeProfile().initialWait[0],
      modeProfile().initialWait[1]
    );
    state.lastMeaningfulActivity = now();
    clearTimeout(state.hoverTimer);
    state.lastHoveredElement = null;
    hideThought();

    const profile = modeProfile();
    const modeExpression =
      profile.expressionMoods?.[0] ||
      (state.mode === "strict" || state.mode === "exam" ? "focused" :
       state.mode === "lazy" || state.mode === "sleepy" ? "bored" :
       state.mode === "playful" || state.mode === "energetic" ? "happy" :
       state.mode === "curious" ? "curious" :
       state.mode === "focused" ? "focused" :
       state.mode === "social" ? "happy" : "curious");

    setExpression(modeExpression, 1000, true);
    showThought(profile.label + " mode.", 1050);
    updateControls();
  }

  function updateControls() {
    enableButton.classList.toggle("is-active", state.enabled);
    disableButton.classList.toggle("is-active", !state.enabled);
    eyeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });
    modeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.petMode === state.mode);
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
      clearTimeout(state.hoverTimer);
      state.lastHoveredElement = null;
      stage.classList.add("is-disabled");
      launcher.classList.remove("is-open");
    } else {
      stage.classList.remove("is-disabled");
      setExpression("surprised", 850, true);
      setGazeTarget(state.pointerX, state.pointerY, false);
      state.lastActivity = now();
      state.lastMeaningfulActivity = now();
      state.nextWander = now() + rand(
        modeProfile().initialWait[0],
        modeProfile().initialWait[1]
      );
      showThought("Pet enabled.", 950);
    }

    updateControls();
  }

  character.dataset.eye = state.eye;
  character.dataset.mode = state.mode;
  state.nextWander = now() + rand(
    modeProfile().initialWait[0],
    modeProfile().initialWait[1]
  );
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

    if (idleFor >= modeProfile().sleepAfter && !state.sleeping && state.angerUntil <= t) {
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