/* Goal completion: one short event, plus a persistent 15-minute theme-aware ambient layer. */
(() => {
  'use strict';
  const EFFECT_KEY = 'studylab:study-room-ambient-effect-v1';
  const LAST_GOAL_KEY = 'studylab:study-room-last-goal-v1';
  const EFFECT_DURATION = 15 * 60 * 1000;
  const PET_CELEBRATION_DURATION = 4000;
  const THEME_PARTICLES = {
    charcoal: ['◇', '◆', '✧', '⋄'],
    dark: ['◇', '◆', '✧', '⋄'],
    mint: ['❄', '◇', '❅', '▢'],
    'midnight-blue': ['✦', '⋆', '✧', '·'],
    pinky: ['🌸', '❀', '✿', '🌷'],
    'forest-green': ['🍃', '❧', '✦', '🍂'],
    lavender: ['✿', '❀', '✧', '⋆'],
    'warm-sand': ['✧', '·', '◇', '✦'],
    ocean: ['○', '◦', '◌', '°']
  };
  let layer = null;
  let expiryTimer = null;
  let activeEffect = null;

  const read = key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  };
  const remove = key => { try { localStorage.removeItem(key); } catch (_) {} };
  const random = (min, max) => min + Math.random() * (max - min);

  function currentTheme() {
    const raw = document.body?.dataset.roomTheme ||
      document.documentElement?.dataset.roomTheme || 'midnight-blue';
    return THEME_PARTICLES[raw] ? raw : 'midnight-blue';
  }

  function ensureLayer() {
    if (layer?.isConnected) return layer;
    layer = document.getElementById('slStudyRoomAmbient');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'slStudyRoomAmbient';
      layer.className = 'sl-room-ambient';
      layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
    }
    return layer;
  }

  function renderParticles() {
    if (!activeEffect || activeEffect.until <= Date.now()) return;
    const host = ensureLayer();
    const theme = currentTheme();
    const symbols = THEME_PARTICLES[theme] || THEME_PARTICLES['midnight-blue'];
    host.dataset.theme = theme;
    host.replaceChildren();
    for (let i = 0; i < 22; i++) {
      const particle = document.createElement('span');
      particle.className = 'sl-room-ambient-particle';
      particle.textContent = symbols[i % symbols.length];
      particle.style.setProperty('--x', random(2, 98).toFixed(2) + '%');
      particle.style.setProperty('--y', random(5, 96).toFixed(2) + '%');
      particle.style.setProperty('--size', random(10, theme === 'pinky' || theme === 'forest-green' ? 19 : 16).toFixed(1) + 'px');
      particle.style.setProperty('--duration', random(19, 38).toFixed(1) + 's');
      particle.style.setProperty('--delay', (-random(0, 34)).toFixed(1) + 's');
      particle.style.setProperty('--drift-x', random(-42, 42).toFixed(1) + 'px');
      particle.style.setProperty('--drift-y', random(-62, 62).toFixed(1) + 'px');
      particle.style.setProperty('--rotation', random(-100, 100).toFixed(1) + 'deg');
      host.append(particle);
    }
  }

  function stopAmbient() {
    activeEffect = null;
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    layer?.remove();
    layer = null;
    remove(EFFECT_KEY);
  }

  function startAmbient(record) {
    if (!record || !Number.isFinite(Number(record.until)) || Number(record.until) <= Date.now()) {
      stopAmbient();
      return;
    }
    activeEffect = { until: Number(record.until), sessionKey: record.sessionKey || '' };
    renderParticles();
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = setTimeout(stopAmbient, Math.max(0, activeEffect.until - Date.now()));
  }

  function sameCompletedSession(previous, state) {
    if (!previous || Date.now() - Number(previous.triggeredAt || 0) > 24 * 60 * 60 * 1000) return false;
    const subject = String(state.subject || '');
    const target = Number(state.targetSeconds) || 0;
    if (previous.subject !== subject || Number(previous.targetSeconds) !== target) return false;
    if (state.sessionStartedAt && previous.sessionStartedAt) {
      return state.sessionStartedAt === previous.sessionStartedAt;
    }
    if (state.targetReachedAt && previous.targetReachedAt) {
      return state.targetReachedAt === previous.targetReachedAt;
    }
    return Boolean(state.targetReachedAt || previous.sessionStartedAt);
  }

  function handleGoal(state) {
    const previous = read(LAST_GOAL_KEY);
    if (sameCompletedSession(previous, state)) {
      if (state.targetReachedAt && !previous.targetReachedAt) {
        previous.targetReachedAt = state.targetReachedAt;
        write(LAST_GOAL_KEY, previous);
      }
      const savedEffect = read(EFFECT_KEY);
      if (savedEffect?.until > Date.now()) startAmbient(savedEffect);
      return;
    }

    const triggeredAt = Date.now();
    const sessionKey = state.sessionStartedAt || state.targetReachedAt ||
      [state.subject || 'subject', Number(state.targetSeconds) || 0, triggeredAt].join(':');
    write(LAST_GOAL_KEY, {
      sessionKey,
      sessionStartedAt: state.sessionStartedAt || null,
      targetReachedAt: state.targetReachedAt || null,
      subject: String(state.subject || ''),
      targetSeconds: Number(state.targetSeconds) || 0,
      triggeredAt
    });
    const effect = { sessionKey, startedAt: triggeredAt, until: triggeredAt + EFFECT_DURATION };
    write(EFFECT_KEY, effect);
    startAmbient(effect);

    window.dispatchEvent(new CustomEvent('studylab:study-room-goal-celebration', {
      detail: {
        duration: PET_CELEBRATION_DURATION,
        subject: state.subject || '',
        targetSeconds: Number(state.targetSeconds) || 0,
        elapsedSeconds: Number(state.elapsedSeconds) || 0
      }
    }));
  }

  window.addEventListener('studylab:study-room-timer', event => {
    const state = event.detail || {};
    const target = Number(state.targetSeconds) || 0;
    if (!state.sessionActive || target <= 0) return;
    if (Number(state.elapsedSeconds) >= target || state.targetReachedAt) handleGoal(state);
  });

  window.addEventListener('studylab:room-theme-change', renderParticles);
  const themeObserver = new MutationObserver(() => {
    if (activeEffect && activeEffect.until > Date.now()) renderParticles();
  });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-room-theme'] });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-room-theme'] });

  const savedEffect = read(EFFECT_KEY);
  if (savedEffect?.until > Date.now()) startAmbient(savedEffect);
  else if (savedEffect) remove(EFFECT_KEY);
})();