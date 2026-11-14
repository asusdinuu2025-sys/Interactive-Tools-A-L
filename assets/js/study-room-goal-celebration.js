/* Permanent theme-aware doodle ambience; each reached goal only celebrates with the pet. */
(() => {
  'use strict';
  const EFFECT_KEY = 'studylab:study-room-ambient-effect-v1';
  const LAST_GOAL_KEY = 'studylab:study-room-last-goal-v1';
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
    if (document.body?.dataset.roomDoodles === 'off') {
      if (layer?.isConnected) layer.remove();
      layer = null;
      return;
    }
    const theme = currentTheme();
    if (layer?.isConnected && layer.dataset.theme === theme) return;
    const host = ensureLayer();
    const symbols = THEME_PARTICLES[theme] || THEME_PARTICLES['midnight-blue'];
    host.dataset.theme = theme;
    host.replaceChildren();
    // Keep permanent ambience lighter than the former 22-particle goal burst.
    const count = window.matchMedia?.('(max-width: 680px)')?.matches ? 10 : 16;
    for (let i = 0; i < count; i++) {
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

  // Doodles controls both static illustrations AND this drifting ambient.
  // Goal completion does not add particles, restart them, or change the layer.
  window.addEventListener('studylab:room-theme-change', renderParticles);
  const themeObserver = new MutationObserver(renderParticles);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-room-theme','data-room-doodles'] });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-room-theme'] });
  // The old expiring effect setting is obsolete; appearance is no longer timed.
  remove(EFFECT_KEY);
  renderParticles();
})();