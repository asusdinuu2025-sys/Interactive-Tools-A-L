/* Visual-only Study Room goal celebration. Reads the existing timer event; makes no RPCs or timer changes. */
(() => {
  'use strict';
  const init = () => {
    if (window.__studyRoomGoalCelebrationReady) return;
    window.__studyRoomGoalCelebrationReady = true;
    let activeKey = null;
    let previousReached = null;
    let dialog = null;
    let returnFocus = null;

    const formatDuration = seconds => {
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return [h, m, s].map(value => String(value).padStart(2, '0')).join(':');
    };

    const close = () => {
      if (!dialog || dialog.hidden) return;
      dialog.classList.remove('is-visible');
      dialog.hidden = true;
      document.body.style.removeProperty('overflow');
      if (returnFocus?.isConnected) returnFocus.focus();
    };

    const ensureDialog = () => {
      if (dialog) return dialog;
      dialog = document.createElement('div');
      dialog.className = 'sl-goal-celebration';
      dialog.id = 'studyRoomGoalCelebration';
      dialog.hidden = true;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'slGoalCelebrationTitle');
      dialog.setAttribute('aria-describedby', 'slGoalCelebrationDescription');
      dialog.innerHTML = `
        <section class="sl-goal-celebration-card" tabindex="-1">
          <div class="sl-goal-sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <div class="sl-goal-celebration-mark" aria-hidden="true">✦</div>
          <h2 id="slGoalCelebrationTitle">Study goal completed!</h2>
          <p id="slGoalCelebrationDescription">You reached your session target. Every focused minute added up.</p>
          <div class="sl-goal-celebration-time" id="slGoalCelebrationTime">00:00:00</div>
          <button type="button" class="sl-goal-celebration-close">Continue</button>
        </section>`;
      document.body.append(dialog);
      dialog.querySelector('.sl-goal-celebration-close').addEventListener('click', close);
      dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
      document.addEventListener('keydown', event => {
        if (dialog.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
          event.preventDefault();
          dialog.querySelector('.sl-goal-celebration-close').focus();
        }
      });
      return dialog;
    };

    const celebrate = state => {
      const layer = ensureDialog();
      returnFocus = document.activeElement;
      layer.querySelector('#slGoalCelebrationTime').textContent = formatDuration(state.elapsedSeconds);
      layer.querySelector('#slGoalCelebrationDescription').textContent =
        'You reached your ' + formatDuration(state.targetSeconds) + ' session target. Every focused minute added up.';
      layer.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        layer.classList.add('is-visible');
        layer.querySelector('.sl-goal-celebration-close').focus();
      });
      window.dispatchEvent(new CustomEvent('studylab:study-room-goal-reached', { detail: {
        elapsedSeconds: state.elapsedSeconds,
        targetSeconds: state.targetSeconds,
        subject: state.subject || ''
      }}));
    };

    window.addEventListener('studylab:study-room-timer', event => {
      const state = event.detail || {};
      const target = Number(state.targetSeconds) || 0;
      if (!state.sessionActive || target <= 0) {
        activeKey = null;
        previousReached = null;
        return;
      }
      const key = state.sessionStartedAt || ('target-' + target);
      const reached = Number(state.elapsedSeconds) >= target;
      if (key !== activeKey) {
        activeKey = key;
        previousReached = reached;
        return;
      }
      if (previousReached === false && reached) celebrate(state);
      previousReached = reached;
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
