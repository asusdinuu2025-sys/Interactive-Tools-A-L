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
    bubble: "studylab-pet-bubble",
    personalities: "studylab-pet-personalities",
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

  const PERSONALITY_NAMES = [
    "natural", "playful", "focused", "curious", "observer"
  ];

  function readPersonalities() {
    const raw = read(KEY.personalities, "");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((name) => PERSONALITY_NAMES.includes(name));
          return [...new Set(clean)];
        }
      } catch (_) {}
    }
    const legacy = read("studylab-pet-mode", "");
    return PERSONALITY_NAMES.includes(legacy) ? [legacy] : ["natural"];
  }

  const state = {
    enabled: bool(KEY.enabled, true),
    eye: read(KEY.eye, "cyan") === "pink" ? "pink" : "cyan",
    bubbleEnabled: bool(KEY.bubble, true),
    personalities: readPersonalities(),
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
    roamActive: false,
    roamVelocityX: 0,
    roamVelocityY: 0,
    roamTargetX: 0,
    roamTargetY: 0,
    roamPausedUntil: 0,
    roamBoostUntil: 0,
    roamLastFrame: performance.now(),

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
    emoteTimer: null,
    bubbleTimer: null,
    blinkTimer: null,
    hoverTimer: null,
    lastHoveredElement: null,
    nameMessageShown: false,
    studentName: "",
    companionName: "Student 0000",
    recentThoughts: [],
    lastThoughtAt: 0,
    recentInteractionKeys: [],
    lastSleepAt: 0,
    wakeGreetingShown: false
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
      '<div class="sl-pet-setting sl-pet-personality-setting"><span>Personalities</span><div class="sl-pet-personality-list">' +
        '<div class="sl-pet-personality-row" data-personality="natural"><strong>Natural</strong><div><button type="button" data-pet-personality-enable="natural">Enable</button><button type="button" data-pet-personality-disable="natural">Disable</button></div></div>' +
        '<div class="sl-pet-personality-row" data-personality="playful"><strong>Playful</strong><div><button type="button" data-pet-personality-enable="playful">Enable</button><button type="button" data-pet-personality-disable="playful">Disable</button></div></div>' +
        '<div class="sl-pet-personality-row" data-personality="focused"><strong>Focused</strong><div><button type="button" data-pet-personality-enable="focused">Enable</button><button type="button" data-pet-personality-disable="focused">Disable</button></div></div>' +
        '<div class="sl-pet-personality-row" data-personality="curious"><strong>Curious</strong><div><button type="button" data-pet-personality-enable="curious">Enable</button><button type="button" data-pet-personality-disable="curious">Disable</button></div></div>' +
        '<div class="sl-pet-personality-row" data-personality="observer"><strong>Observer</strong><div><button type="button" data-pet-personality-enable="observer">Enable</button><button type="button" data-pet-personality-disable="observer">Disable</button></div></div>' +
      '</div></div>' +
      '<div class="sl-pet-setting"><span>Message box</span><div class="sl-pet-setting-buttons">' +
        '<button type="button" data-pet-bubble-enable>Enable</button><button type="button" data-pet-bubble-disable>Disable</button>' +
      '</div></div>' +
      '<p class="sl-pet-panel-note">Multiple personalities can work together.</p>' +
    '</aside>'
  );

  const stage = document.getElementById("studylabPetStage");
  const character = stage.querySelector(".sl-pet-character");
  const visual = stage.querySelector(".sl-pet-visual");
  const eyes = [...stage.querySelectorAll(".sl-pet-eye > i")];
  const thought = stage.querySelector("[data-pet-thought]");
  const thoughtText = stage.querySelector("[data-pet-thought-text]");
  const emote = stage.querySelector("[data-pet-emote]");
  const emoteIcon = stage.querySelector("[data-pet-emote-icon]");
  const launcher = document.getElementById("studylabPetLauncher");
  const panel = document.getElementById("studylabPetPanel");
  const closeButton = panel.querySelector("[data-pet-close]");
  const enableButton = panel.querySelector("[data-pet-enable]");
  const disableButton = panel.querySelector("[data-pet-disable]");
  const eyeButtons = [...panel.querySelectorAll("[data-pet-eye]")];
  const personalityEnableButtons = [...panel.querySelectorAll("[data-pet-personality-enable]")];
  const personalityDisableButtons = [...panel.querySelectorAll("[data-pet-personality-disable]")];
  const bubbleEnableButton = panel.querySelector("[data-pet-bubble-enable]");
  const bubbleDisableButton = panel.querySelector("[data-pet-bubble-disable]");

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
    const t = now();
    state.lastActivity = t;
    if (!state.sleeping) return;

    const sleptFor = state.lastSleepAt ? t - state.lastSleepAt : 0;
    state.sleeping = false;
    state.wakeGreetingShown = false;
    character.dataset.state = "curious";
    state.expression = "curious";
    state.nextBlink = t + rand(2800, 5200);

    if (sleptFor >= 5000 && state.enabled && state.bubbleEnabled) {
      state.wakeGreetingShown = true;
      setTimeout(() => {
        if (!state.enabled || !state.bubbleEnabled || state.sleeping) return;
        setExpression("delighted", 1200, true);
        showThought("Oh, " + state.companionName + " is back.", 1900);
      }, 130);
    }
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

  const thoughtVariants = {
    "Focus, work, break.":["Focus, work, break.","One task at a time.","Keep the rhythm."],
    "Recall before reveal.":["Try remembering first.","Give your memory a turn.","Don't reveal it yet."],
    "Find the pattern.":["Mistakes leave clues.","Let's find what changed.","That one has a lesson."],
    "Plan the next task.":["One step at a time.","What comes next?","Make the next move count."],
    "Check before targeting.":["Measure first.","Check the target twice.","Numbers behave better when checked."],
    "Time + accuracy.":["Watch both the clock and the answer.","Speed matters, but so does accuracy.","Stay sharp."],
    "Convert, then verify.":["Convert it, then check it.","Units first. Confidence second.","Let's make the units behave."],
    "Relative motion → frequency.":["Motion changes what you hear.","Relative motion matters here.","Listen for the shift."],
    "Masses attract each other.":["Gravity never really clocks out.","Everything with mass pulls a little.","Tiny pull, big consequence."],
    "Forces change motion.":["Forces leave fingerprints.","Watch what the force changes.","Motion follows the push and pull."],
    "Amplitude • frequency • phase.":["Three clues: amplitude, frequency, phase.","Watch the pattern change.","Waves have a rhythm."],
    "Current • voltage • resistance.":["Keep an eye on the circuit.","Current, voltage, resistance.","Let's follow the charge."],
    "Watch the endpoint.":["The endpoint is hiding in plain sight.","Watch for the change.","Easy hand, sharp eye."],
    "Particles • bonds • reactions.":["Something interesting is happening at the particle level.","Bonds, particles, reactions.","Chemistry likes to rearrange things."],
    "Observe before concluding.":["Look closely first.","Observation before conclusion.","Tiny details can matter."],
    "Check signs and quadrants.":["Signs matter here.","Quadrants can trick you.","Check the angle before trusting it."],
    "Define the variable first.":["Name the variable before chasing it.","One clean definition helps.","Start with the variable."],
    "Magnitude + direction.":["Size and direction.","Vectors like both parts.","Don't lose the direction."],
    "Isolate x, then check.":["Move the pieces, then check.","One step at a time.","Solve it, then verify it."],
    "Structure • function • systems.":["Structure tells a story.","Function follows the structure.","Biology is full of connections."],
    "Spot repeated patterns.":["Past papers leave clues.","Look for recurring ideas.","Patterns show up eventually."],
    "Change one variable.":["Change one thing and watch.","One variable at a time.","Let's see what moves."],
    "Study resources live here.":["There's useful stuff here.","The study trail continues.","A little resource treasure."],
    "Narrow the search term.":["A tighter search should help.","Try a sharper keyword.","Let's narrow it down."],
    "Keep this for later.":["Good one to keep.","Save it before you forget.","That might be useful later."],
    "Ready for the PDF.":["That one looks ready to take with you.","Paper time.","A PDF for future-you."],
    "Open it and start.":["Go on, open it.","Ready when you are.","Let's see what's inside."],
    "Careful: data may clear.":["Easy there.","That button deserves a second look.","Careful with the data."],
    "Choose what to study.":["Where are we going?","What's interesting today?","Pick a path."],
    "Choose the next study task.":["What's the next little task?","One useful thing at a time.","Let's pick the next move."]
  };

  function freshThought(message) {
    if (!message) return "";
    const candidates = Array.isArray(message)
      ? message
      : (thoughtVariants[message] || [message]);
    const clean = [...new Set(candidates.filter(Boolean))];
    if (!clean.length) return "";
    const recent = new Set(state.recentThoughts);
    const fresh = clean.filter((item) => !recent.has(item));
    const selected = pick(fresh.length ? fresh : clean);
    state.recentThoughts = [selected, ...state.recentThoughts.filter((item) => item !== selected)].slice(0, 6);
    return selected;
  }

  function showThought(message, duration = 1800, force = false) {
    if (!state.enabled || (!state.bubbleEnabled && !force) || !message) return;
    const previous = state.recentThoughts[0];
    const selected = freshThought(message);
    if (!selected) return;
    const t = now();
    if (selected === previous && t - state.lastThoughtAt < 4200) return;
    state.lastThoughtAt = t;
    thoughtText.textContent = selected;
    placeThought();
    thought.classList.add("is-visible");
    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(() => thought.classList.remove("is-visible"), duration);
  }

  function displayNameForBubble(name) {
    const clean = String(name || "").trim().replace(/s+/g, " ");
    const placeholder = clean.match(/^Students*([0-9]{4})$/i);
    if (placeholder) return "Student " + placeholder[1];
    if (!clean) return "Student";
    const first = clean.split(" ")[0];
    return first.length <= 14 ? first : first.slice(0, 13) + "…";
  }

  function setStudentIdentity(name) {
    const clean = String(name || "").trim().replace(/s+/g, " ");
    if (!clean) return false;
    const next = displayNameForBubble(clean);
    const changed = state.studentName !== clean;
    state.studentName = clean;
    state.companionName = next;
    return changed;
  }

  function sessionFlag(key) {
    try { return sessionStorage.getItem(key) === "1"; } catch (_) { return false; }
  }

  function setSessionFlag(key) {
    try { sessionStorage.setItem(key, "1"); } catch (_) {}
  }

  function initialWelcome() {
    if (!state.enabled || !state.bubbleEnabled || sessionFlag("studylab-pet-welcomed")) return;
    setSessionFlag("studylab-pet-welcomed");
    setTimeout(() => {
      if (!state.enabled || !state.bubbleEnabled || state.sleeping) return;
      setExpression("delighted", 1250, true);
      showThought("Hi " + state.companionName + "!", 1900);
    }, 600);
  }

  async function loadStudentIdentity() {
    try {
      const account = window.StudyLabAccount;
      if (account?.ready) {
        await account.ready;
        const profile = await account.getProfile();
        if (profile?.display_name) setStudentIdentity(profile.display_name);
      }
    } catch (_) {}
    initialWelcome();
  }

  function hideThought() {
    thought.classList.remove("is-visible");
  }

  const expressionNames = [
    "neutral", "curious", "happy", "excited", "focused", "thinking",
    "alert", "worried", "confused", "suspicious", "bored", "sleeping",
    "relieved", "sad",
    "angry", "scared", "annoyed", "delighted", "surprised", "shy"
  ];

  const personalityEmotes = {
    natural:  { icon:"👋", expression:"delighted" },
    playful:  { icon:"🎉", expression:"excited" },
    focused:  { icon:"🎯", expression:"focused" },
    curious:  { icon:"🔎", expression:"curious" },
    observer: { icon:"👀", expression:"suspicious" }
  };

  function showPersonalityEmote(name) {
    const em = personalityEmotes[name];
    if (!em || !state.enabled) return;

    clearTimeout(state.emoteTimer);
    emote.dataset.emote = name;
    emoteIcon.textContent = em.icon;
    emote.classList.remove("is-visible");
    void emote.offsetWidth;
    emote.classList.add("is-visible");

    setExpression(em.expression, 1350, true);

    if (name === "playful" && !state.sleeping && !state.dragging && !reduced) {
      state.roamActive = true;
      state.roamPausedUntil = 0;
      state.roamBoostUntil = now() + 7600;
      chooseRoamTarget(true);
      state.roamVelocityX *= 0.42;
      state.roamVelocityY *= 0.42;
    }

    state.emoteTimer = setTimeout(() => {
      emote.classList.remove("is-visible");
    }, 1450);
  }

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
    home:["Choose what to study.","What's interesting today?","Pick a path."],
    physics:["Physics time.","Let's see what moves.","Watch the cause and effect."],
    chemistry:["Chemistry time.","Something is reacting.","Let's see what changed."],
    maths:["Maths time.","Think first, then solve.","Let's make the steps behave."],
    biology:["Life is doing something interesting.","Look at the structure.","Biology has patterns everywhere."],
    study:["Choose the next little task.","One useful thing at a time.","Let's pick the next move."],
    exam:["Read carefully.","Stay calm and watch the time.","One question at a time."],
    social:["Something useful may be hiding here.","Study resources live here.","The community shelf."]
  };

  const contextActionFallback = {
    home:["Opening this StudyLab item.","Let's see.","Off we go."],
    physics:["Opening physics work.","Let's follow the motion.","Physics is calling."],
    chemistry:["Opening chemistry work.","Let's inspect the reaction.","Chemistry time."],
    maths:["Opening maths work.","Let's solve it carefully.","Maths time."],
    biology:["Opening biology work.","Let's inspect the system.","Biology time."],
    study:["Opening this study tool.","Let's make this count.","One useful tool."],
    exam:["Opening exam material.","Let's tackle it carefully.","Exam work."],
    social:["Opening community resources.","Let's see what's there.","Community resources."]
  };

  const personalityProfiles = {
    natural:{label:"Natural",moveScale:1.00,minMove:320,wanderWait:[18000,30000],initialWait:[9000,15000],sleepAfter:34000,cardBias:.46,hoverDelay:160,expressionMoods:["neutral","curious","thinking","happy"],angerDuration:[4500,6500],angerFactor:1.00,playfulness:0},
    playful:{label:"Playful",moveScale:.86,minMove:300,wanderWait:[8500,15000],initialWait:[5000,8000],sleepAfter:45000,cardBias:.60,hoverDelay:100,expressionMoods:["happy","excited","curious","surprised"],angerDuration:[3800,5400],angerFactor:1.00,playfulness:1},
    focused:{label:"Focused",moveScale:1.04,minMove:350,wanderWait:[19000,31000],initialWait:[10000,17000],sleepAfter:50000,cardBias:.78,hoverDelay:140,expressionMoods:["focused","thinking","alert"],angerDuration:[4600,6600],angerFactor:1.05,playfulness:0},
    curious:{label:"Curious",moveScale:.95,minMove:310,wanderWait:[11000,19000],initialWait:[5500,9000],sleepAfter:42000,cardBias:.86,hoverDelay:75,expressionMoods:["curious","surprised","thinking","delighted"],angerDuration:[4000,5600],angerFactor:1.00,playfulness:.35},
    observer:{label:"Observer",moveScale:1.15,minMove:370,wanderWait:[26000,42000],initialWait:[14000,23000],sleepAfter:38000,cardBias:.90,hoverDelay:240,expressionMoods:["curious","focused","neutral","suspicious"],angerDuration:[3800,5400],angerFactor:.95,playfulness:.08}
  };

  function enabledPersonalities() {
    return state.personalities.filter((name) => personalityProfiles[name]);
  }

  function combinedProfile() {
    const keys = enabledPersonalities();
    if (!keys.length) return {
      ...personalityProfiles.natural,
      expressionMoods:["neutral"]
    };

    const profiles = keys.map((key) => personalityProfiles[key]);
    const average = (field) => profiles.reduce((sum, profile) => sum + profile[field], 0) / profiles.length;
    const rangeAverage = (field) => [
      profiles.reduce((sum, profile) => sum + profile[field][0], 0) / profiles.length,
      profiles.reduce((sum, profile) => sum + profile[field][1], 0) / profiles.length
    ];
    const moods = [...new Set(profiles.flatMap((profile) => profile.expressionMoods || []))];

    return {
      moveScale: average("moveScale"),
      minMove: average("minMove"),
      wanderWait: rangeAverage("wanderWait"),
      initialWait: rangeAverage("initialWait"),
      sleepAfter: average("sleepAfter"),
      cardBias: average("cardBias"),
      hoverDelay: average("hoverDelay"),
      angerDuration: rangeAverage("angerDuration"),
      angerFactor: average("angerFactor"),
      playfulness: average("playfulness"),
      expressionMoods: moods.length ? moods : null
    };
  }

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
    return combinedProfile();
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

  function interactionKey(el) {
    if (!el) return "";
    const href = el.getAttribute("href") || "";
    const id = el.id || "";
    const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
    const heading = el.querySelector?.("h1,h2,h3,h4,h5,h6,.card-title,.utility-card-title,.subject-title,.tool-title,strong")?.textContent || "";
    return [href, id, label, heading].join("|").replace(/s+/g, " ").slice(0, 180).toLowerCase();
  }

  function reactToElement(el, type) {
    if (!state.enabled || !el || el === character || character.contains(el) || el === launcher || panel.contains(el)) return;

    const time = now();
    if (type === "click" && time - state.lastReaction < 350) return;

    const key = interactionKey(el);
    if (type === "hover" && key &&
        state.recentInteractionKeys.some((item) => item.key === key && time - item.time < 6500)) {
      return;
    }

    state.recentInteractionKeys = [
      ...(key ? [{ key, time }] : []),
      ...state.recentInteractionKeys.filter((item) => item.key !== key && time - item.time < 16000)
    ].slice(0, 12);

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

  function animationLoop(timestamp) {
    updateGaze();
    updateRoam(timestamp);
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


  function hasPlayfulPersonality() {
    return state.personalities.includes("playful");
  }

  function playfulWanderTarget() {
    return {
      x: 70 + Math.random() * Math.max(1, window.innerWidth - 140),
      y: 88 + Math.random() * Math.max(1, window.innerHeight - 190)
    };
  }

  function cubicBezierY(t, p1, p2) {
    const mt = 1 - t;
    return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
  }

  function cubicBezierX(t, p1, p2) {
    const mt = 1 - t;
    return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
  }

  function cubicBezierEase(x, x1, y1, x2, y2) {
    let lo = 0;
    let hi = 1;
    let t = x;

    for (let i = 0; i < 9; i++) {
      const bx = cubicBezierX(t, x1, x2) - x;
      const derivative =
        3 * (1 - t) * (1 - t) * x1 +
        6 * (1 - t) * t * (x2 - x1) +
        3 * t * t * (1 - x2);

      if (Math.abs(derivative) > 0.00001) {
        t = clamp(t - bx / derivative, 0, 1);
      } else {
        break;
      }
    }

    for (let i = 0; i < 12; i++) {
      const bx = cubicBezierX(t, x1, x2);
      if (Math.abs(bx - x) < 0.00001) break;
      if (bx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }

    return cubicBezierY(t, y1, y2);
  }

  function playfulMoveDurationAndEase(direction) {
    if (direction === "up") {
      return { duration: 1120, ease: [0.22, 0.68, 0.18, 1] };
    }
    if (direction === "down") {
      return { duration: 520, ease: [0.15, 0.90, 0.28, 1.25] };
    }
    return { duration: 760, ease: [0.22, 0.78, 0.20, 1] };
  }

  function animatePlayfulMoveTo(targetX, targetY, reason = "wander") {
    if (!state.enabled || state.dragging || reduced || state.sleeping) return false;

    stopMove();

    const startX = state.x;
    const startY = state.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.hypot(dx, dy);
    const minimumDistance = reason === "evade" ? 150 : 0;

    if (distance < minimumDistance) return false;

    const direction = visualDirection(dx, dy);
    const motion = playfulMoveDurationAndEase(direction);
    const started = performance.now();
    const token = state.moveToken;

    character.dataset.moving = "true";
    character.dataset.direction = direction;
    character.classList.remove("is-walking", "is-climbing", "is-falling", "is-landed");

    if (direction === "up") {
      character.classList.add("is-climbing");
      setExpression(modeExpression("focused"), 1150);
    } else if (direction === "down") {
      character.classList.add("is-falling");
      setExpression(modeExpression("alert"), 900);
    } else {
      character.classList.add("is-walking");
      setExpression(modeExpression("neutral"), 1000);
    }

    function frame(timestamp) {
      if (token !== state.moveToken || state.dragging || !state.enabled) return;

      const p = clamp((timestamp - started) / motion.duration, 0, 1);
      const e = cubicBezierEase(
        p,
        motion.ease[0],
        motion.ease[1],
        motion.ease[2],
        motion.ease[3]
      );

      setPosition(startX + dx * e, startY + dy * e);

      if (p < 1) {
        state.moveAnimation = requestAnimationFrame(frame);
        return;
      }

      state.moveAnimation = 0;
      character.dataset.moving = "false";
      character.dataset.direction = "idle";
      character.classList.remove("is-walking", "is-climbing", "is-falling");

      if (direction === "down") {
        character.classList.add("is-landed");
        setTimeout(() => character.classList.remove("is-landed"), 480);
      }

      if (reason === "wander") {
        state.lastWander = now();
        state.nextWander = now() + (
          state.context === "study"
            ? rand(2400, 5000)
            : rand(3600, 8800)
        );
      }

      if (reason === "evade") {
        setTimeout(() => { state.evading = false; }, rand(450, 850));
      }
    }

    state.moveAnimation = requestAnimationFrame(frame);
    return true;
  }

  function playfulWander() {
    if (!state.enabled || state.sleeping || state.dragging || reduced || state.angerUntil > now()) return;
    const target = playfulWanderTarget();
    state.roamActive = false;
    state.roamPausedUntil = 0;
    state.roamVelocityX = 0;
    state.roamVelocityY = 0;
    const moved = animatePlayfulMoveTo(target.x, target.y, "wander");

    if (!moved) {
      state.nextWander = now() + (
        state.context === "study"
          ? rand(2400, 5000)
          : rand(3600, 8800)
      );
    }
  }

  function stopMove() {
    if (state.moveAnimation) cancelAnimationFrame(state.moveAnimation);
    state.moveAnimation = 0;
    state.moveToken += 1;
    state.roamActive = false;
    state.roamPausedUntil = 0;
    state.roamVelocityX = 0;
    state.roamVelocityY = 0;
    character.dataset.moving = "false";
    character.dataset.direction = "idle";
    visual.style.transform = "";
  }

  function animateMoveTo
(targetX, targetY, reason = "wander") {
    if (!state.enabled || state.dragging || reduced || state.sleeping) return false;

    stopMove();

    const startX = state.x;
    const startY = state.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.hypot(dx, dy);

    const minimumDistance = reason === "evade" ? 150 : minimumWalkDistance();
    if (distance < minimumDistance) return false;

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
    return true;
  }

  function roamSpeed() {
    const profile = modeProfile();
    const base = clamp(36 / profile.moveScale, 28, 48);
    return base * (now() < state.roamBoostUntil ? 1.42 : 1);
  }

  function chooseRoamTarget(immediate = false) {
    const speed = Math.hypot(state.roamVelocityX, state.roamVelocityY);
    const profile = modeProfile();
    const playful = clamp(profile.playfulness || 0, 0, 1);
    const baseAngle = speed > 6
      ? Math.atan2(state.roamVelocityY, state.roamVelocityX)
      : rand(0, Math.PI * 2);
    const turnRange = 0.82 + playful * 0.58;
    const angle = baseAngle + rand(-turnRange, turnRange);
    const distance = immediate
      ? (playful > 0.55 ? rand(330, 620) : rand(450, 720))
      : (playful > 0.55 ? rand(300, 650) : rand(380, 760));

    let x = state.x + Math.cos(angle) * distance;
    let y = state.y + Math.sin(angle) * distance * 0.78;

    if (x < 90 || x > window.innerWidth - 90 || y < 112 || y > window.innerHeight - 120) {
      const safe = randomSafePoint();
      x = safe.x;
      y = safe.y;
    }

    state.roamTargetX = clamp(x, 65, Math.max(65, window.innerWidth - 65));
    state.roamTargetY = clamp(y, 100, Math.max(100, window.innerHeight - 112));
  }

  function updateRoam(timestamp) {
    if (hasPlayfulPersonality()) {
      state.roamLastFrame = timestamp;
      return;
    }

    if (!state.enabled || state.sleeping || state.dragging || state.evading ||
        state.angerUntil > now() || reduced || !state.roamActive) {
      state.roamLastFrame = timestamp;
      return;
    }

    const previous = state.roamLastFrame || timestamp;
    const dt = clamp((timestamp - previous) / 1000, 0.001, 0.040);
    state.roamLastFrame = timestamp;
    const t = now();
    const profile = modeProfile();
    const playful = clamp(profile.playfulness || 0, 0, 1);

    if (!state.roamTargetX && !state.roamTargetY) chooseRoamTarget(true);

    if (state.roamPausedUntil > t) {
      const brake = Math.pow(0.035, dt);
      state.roamVelocityX *= brake;
      state.roamVelocityY *= brake;
    } else {
      const dx = state.roamTargetX - state.x;
      const dy = state.roamTargetY - state.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const currentSpeed = Math.hypot(state.roamVelocityX, state.roamVelocityY);
      const maxSpeed = roamSpeed();
      const pace = 1 + Math.sin(t * 0.00123) * 0.13 * playful;

      /* Smooth arrival and smooth acceleration. */
      const arrival = clamp(distance / (210 - playful * 45), 0.20, 1);
      const desiredSpeed = maxSpeed * arrival * pace;
      const desiredX = (dx / distance) * desiredSpeed;
      const desiredY = (dy / distance) * desiredSpeed;

      const edge = 120;
      let steerX = desiredX;
      let steerY = desiredY;

      if (state.x < edge) steerX += (edge - state.x) / edge * maxSpeed * 2.2;
      if (state.x > window.innerWidth - edge) steerX -= (state.x - (window.innerWidth - edge)) / edge * maxSpeed * 2.2;
      if (state.y < edge) steerY += (edge - state.y) / edge * maxSpeed * 2.2;
      if (state.y > window.innerHeight - 125) steerY -= (state.y - (window.innerHeight - 125)) / 125 * maxSpeed * 2.2;

      /* Very small curved drift makes the path feel organic rather than programmed. */
      const curve = Math.sin(t * 0.00037) * (0.16 + playful * 0.34);
      steerX += -desiredY * curve;
      steerY += desiredX * curve;

      if (playful > 0 && distance > 90) {
        const playWave = Math.sin(t * 0.00108 + state.roamTargetX * 0.0017) *
          maxSpeed * 0.19 * playful;
        steerX += -(dy / distance) * playWave;
        steerY += (dx / distance) * playWave;
      }

      const response = 1 - Math.exp(-dt / 0.95);
      state.roamVelocityX += (steerX - state.roamVelocityX) * response;
      state.roamVelocityY += (steerY - state.roamVelocityY) * response;

      const nextSpeed = Math.hypot(state.roamVelocityX, state.roamVelocityY);
      if (nextSpeed > maxSpeed) {
        const scale = maxSpeed / nextSpeed;
        state.roamVelocityX *= scale;
        state.roamVelocityY *= scale;
      }

      if (distance < 95) {
        const pause = Math.random() < (0.16 + playful * 0.08);
        if (pause) state.roamPausedUntil = t + rand(700, 1500);
        chooseRoamTarget(false);
      }
    }

    const nextX = state.x + state.roamVelocityX * dt;
    const nextY = state.y + state.roamVelocityY * dt;
    setPosition(
      clamp(nextX, 58, Math.max(58, window.innerWidth - 58)),
      clamp(nextY, 94, Math.max(94, window.innerHeight - 108))
    );

    const speed = Math.hypot(state.roamVelocityX, state.roamVelocityY);
    character.dataset.moving = speed > 3.5 ? "true" : "false";
    character.dataset.direction = speed > 3.5
      ? visualDirection(state.roamVelocityX, state.roamVelocityY)
      : "idle";

    if (speed > 7 && state.expression === "neutral" && t - state.lastReaction > 3400) {
      setExpression(modeExpression(pick(["curious","happy","focused","thinking"])), rand(900, 1500));
    }
  }

  function startRoam(boost = false) {
    if (!state.enabled || state.sleeping || state.dragging || reduced) return;
    state.roamActive = true;
    state.roamLastFrame = performance.now();
    state.roamBoostUntil = boost ? now() + 5200 : 0;
    chooseRoamTarget(true);

    if (boost) {
      state.roamVelocityX *= 0.28;
      state.roamVelocityY *= 0.28;
      setExpression("delighted", 1450, true);
    }
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

    if (hasPlayfulPersonality()) {
      playfulWander();
      return;
    }

    startRoam(false);
    state.lastWander = now();
    state.nextWander = now() + rand(
      modeProfile().wanderWait[0],
      modeProfile().wanderWait[1]
    );
  }

  function evadeCursor(force = false) {
    if (!state.enabled || state.dragging || reduced) return false;
    if (state.evading && !force) return false;
    if (!force && now() < state.nextEvade) return false;
    if (state.moveAnimation && !force) return false;

    const pointerDx = state.x - state.pointerX;
    const pointerDy = state.y - state.pointerY;
    const pointerDistance = Math.hypot(pointerDx, pointerDy);
    let baseAngle = Math.atan2(pointerDy, pointerDx);

    if (!Number.isFinite(baseAngle) || pointerDistance < 28) {
      baseAngle = rand(0, Math.PI * 2);
    }

    const avoidRadius = state.angerLevel >= 4 ? 255 : 225;
    const distances = state.angerLevel >= 4 ? [300, 330, 360] : [260, 290, 320];
    const angleOffsets = [0, -0.28, 0.28, -0.56, 0.56, -0.90, 0.90];

    let best = null;
    let bestScore = -Infinity;

    for (const offset of angleOffsets) {
      for (const distance of distances) {
        const angle = baseAngle + offset;
        const candidate = {
          x: clamp(state.x + Math.cos(angle) * distance, 58, window.innerWidth - 58),
          y: clamp(state.y + Math.sin(angle) * distance * 0.78, 94, window.innerHeight - 108)
        };

        const movement = Math.hypot(candidate.x - state.x, candidate.y - state.y);
        const fromCursor = Math.hypot(candidate.x - state.pointerX, candidate.y - state.pointerY);
        const score = fromCursor * 2.2 + movement * 0.35;

        if (movement >= 150 && fromCursor >= avoidRadius && score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
    }

    if (!best) {
      const fallbackAngle = baseAngle + (Math.PI * (Math.random() < 0.5 ? 0.72 : -0.72));
      best = {
        x: clamp(state.x + Math.cos(fallbackAngle) * 280, 58, window.innerWidth - 58),
        y: clamp(state.y + Math.sin(fallbackAngle) * 280 * 0.78, 94, window.innerHeight - 108)
      };
    }

    setExpression("angry", 900, true);
    state.nextEvade = now() + rand(520, 850);
    state.evading = true;

    const moved = animateMoveTo(best.x, best.y, "evade");
    if (!moved) {
      state.evading = false;
      state.nextEvade = now() + 220;
      return false;
    }

    return true;
  }

  function enterAnger(level = 1) {
    if (!state.enabled) return;

    const profile = modeProfile();

    state.sleeping = false;
    state.angerLevel = clamp(Math.max(state.angerLevel, level), 1, 5);
    state.angerUntil = now() + rand(
      profile.angerDuration[0] * profile.angerFactor,
      profile.angerDuration[1] * profile.angerFactor
    );
    state.danger = true;
    character.dataset.danger = "true";
    character.dataset.angerLevel = String(state.angerLevel);
    clearTimeout(state.angerTimer);
    setExpression("angry", 1700, true);
    state.evading = false;
    setGazeTarget(state.pointerX, state.pointerY, true);

    if (state.angerLevel >= 2) {
      const angerThoughts = state.angerLevel >= 4
        ? ["Hey... easy.","Please stop.","Too much now."]
        : ["Easy there.","Again?","Hey..."];
      showThought(angerThoughts, 1100);
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
      showThought(["Easy...","You clicked twice.","I'm right here."], 900);
    } else {
      setExpression(state.eye === "cyan" ? "curious" : "shy", 850, true);
      showThought(["Hm?","You called?","I'm here."], 850);
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
        showThought(value.length >= 2 ? "I see the name." : "I'm watching.", 1050);
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

  window.addEventListener("studylab-profile-updated", (event) => {
    const nextName = event.detail?.display_name;
    if (!nextName) return;
    const changed = setStudentIdentity(nextName);
    if (!changed || !state.enabled || !state.bubbleEnabled) return;
    state.lastMeaningfulActivity = now();
    setExpression("delighted", 1100);
    showThought("Nice, " + state.companionName + ".", 1700);
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
      notifySetting("Eye colour: " + (state.eye === "cyan" ? "Cyan" : "Pink") + ".");
      updateControls();
    });
  });

  personalityEnableButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setPersonalityEnabled(button.dataset.petPersonalityEnable, true);
    });
  });

  personalityDisableButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setPersonalityEnabled(button.dataset.petPersonalityDisable, false);
    });
  });

  bubbleEnableButton.addEventListener("click", () => {
    state.lastMeaningfulActivity = now();
    setBubbleEnabled(true);
    updateControls();
  });

  bubbleDisableButton.addEventListener("click", () => {
    state.lastMeaningfulActivity = now();
    setBubbleEnabled(false);
    updateControls();
  });

  function personalityLabel(name) {
    const labels = {
      natural:"Natural", playful:"Playful", focused:"Focused",
      curious:"Curious", observer:"Observer"
    };
    return labels[name] || name;
  }

  function savePersonalities() {
    state.personalities = [...new Set(
      state.personalities.filter((name) => PERSONALITY_NAMES.includes(name))
    )];

    save(KEY.personalities, JSON.stringify(state.personalities));
    character.dataset.personalities = state.personalities.join(",");
    character.dataset.playful = state.personalities.includes("playful") ? "true" : "false";
  }

  function notifySetting(message, duration = 1100) {
    if (state.enabled && state.bubbleEnabled) {
      showThought(message, duration);
    }
  }

  function setPersonalityEnabled(name, enabled) {
    if (!PERSONALITY_NAMES.includes(name)) return;

    const has = state.personalities.includes(name);
    if (has === enabled) {
      notifySetting(personalityLabel(name) + (enabled ? " enabled." : " disabled."));
      return;
    }

    state.lastMeaningfulActivity = now();

    if (enabled) {
      state.personalities = [...state.personalities, name];
    } else {
      state.personalities = state.personalities.filter((item) => item !== name);
    }

    savePersonalities();

    if (name === "angry" && !enabled) {
      state.angerUntil = 0;
      state.angerLevel = 0;
      state.danger = false;
      state.evading = false;
      character.dataset.danger = "false";
      character.dataset.angerLevel = "0";
    }

    if (hasPlayfulPersonality()) {
      stopMove();
      state.nextWander = now() + 2600;
    } else {
      const profile = modeProfile();
      state.nextWander = now() + rand(profile.initialWait[0], profile.initialWait[1]);
    }
    clearTimeout(state.hoverTimer);
    state.lastHoveredElement = null;

    setExpression(
      profile.expressionMoods?.[0] || (enabled ? "delighted" : "neutral"),
      1000,
      true
    );

    if (enabled) {
      showPersonalityEmote(name);
    }

    if (hasPlayfulPersonality()) {
      stopMove();
      state.nextWander = now() + 2600;
    } else {
      startRoam(false);
      const profile = modeProfile();
      state.nextWander = now() + rand(profile.initialWait[0], profile.initialWait[1]);
    }

    notifySetting(personalityLabel(name) + (enabled ? " enabled." : " disabled."));
    updateControls();
  }

  function setBubbleEnabled(enabled) {
    if (enabled === state.bubbleEnabled) {
      if (state.enabled && enabled) {
        showThought("Message box already enabled.", 900);
      }
      return;
    }

    if (!enabled) {
      if (state.enabled && state.bubbleEnabled) {
        showThought("Message box disabled.", 900);
      }
      state.bubbleEnabled = false;
      save(KEY.bubble, false);
      clearTimeout(state.bubbleTimer);
      setTimeout(() => thought.classList.remove("is-visible"), 820);
    } else {
      state.bubbleEnabled = true;
      save(KEY.bubble, true);
      showThought("Message box enabled.", 1100);
    }

    updateControls();
  }

  function updateControls() {
    enableButton.classList.toggle("is-active", state.enabled);
    disableButton.classList.toggle("is-active", !state.enabled);

    eyeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.petEye === state.eye);
    });

    personalityEnableButtons.forEach((button) => {
      const name = button.dataset.petPersonalityEnable;
      button.classList.toggle("is-active", state.personalities.includes(name));
    });

    personalityDisableButtons.forEach((button) => {
      const name = button.dataset.petPersonalityDisable;
      button.classList.toggle("is-active", !state.personalities.includes(name));
    });

    bubbleEnableButton.classList.toggle("is-active", state.bubbleEnabled);
    bubbleDisableButton.classList.toggle("is-active", !state.bubbleEnabled);
  }

    function setEnabled(enabled) {
    if (enabled === state.enabled) {
      if (enabled) notifySetting("Pet already enabled.");
      return;
    }

    if (!enabled && state.enabled && state.bubbleEnabled) {
      showThought("Pet disabled.", 1000);
    }

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
      clearTimeout(state.hoverTimer);
      state.lastHoveredElement = null;
      character.dataset.danger = "false";
      character.dataset.angerLevel = "0";

      state.enabled = false;
      character.dataset.state = "sad";
      character.classList.add("is-fading-out");
      stage.classList.remove("is-disabled");
      launcher.classList.remove("is-open");

      window.setTimeout(() => {
        if (!state.enabled) stage.classList.add("is-disabled");
      }, 920);
    } else {
      stage.classList.remove("is-disabled");
      character.classList.remove("is-fading-out");
      state.enabled = true;
      setExpression("delighted", 1350, true);
      setGazeTarget(state.pointerX, state.pointerY, false);
      state.lastActivity = now();
      state.lastMeaningfulActivity = now();
      state.lastReaction = now();

      if (hasPlayfulPersonality()) {
        state.nextWander = now() + 2600;
      } else {
        state.nextWander = now() + 350;
        startRoam(true);
      }

      if (state.bubbleEnabled) showThought("I'm back.", 1050);
    }

    updateControls();
  }

  savePersonalities();
  character.dataset.eye = state.eye;
  character.dataset.personalities = state.personalities.join(",");
  character.dataset.playful = state.personalities.includes("playful") ? "true" : "false";

  if (hasPlayfulPersonality()) {
    state.nextWander = now() + 2600;
  } else {
    state.nextWander = now() + rand(
      modeProfile().initialWait[0],
      modeProfile().initialWait[1]
    );
  }
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
      state.lastSleepAt = t;
      state.wakeGreetingShown = false;
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
  loadStudentIdentity();
})();