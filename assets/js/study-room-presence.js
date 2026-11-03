/* Shared presence tracking for the main Study Room, detached timer, and PiP window. */
(() => {
  "use strict";
  const PREFIX = "studylab:study-room-presence:";
  const RECORD_TTL_MS = 30000;
  const AWAY_GRACE_MS = 60000;
  const PULSE_MS = 20000;

  function start({ userId, onPresenceChange, onPulse, onUnloadAway } = {}) {
    if (!userId || typeof onPresenceChange !== "function") return null;
    const prefix = PREFIX + userId + ":";
    const windows = new Map();
    let awayTimer = null;
    let syncTimer = null;
    let noActiveSince = null;
    let serverPresence = null;
    let pendingPresence = null;
    let lastPulseAt = 0;
    let stopped = false;

    function storageSet(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (error) { console.warn("Study Room presence storage unavailable", error); return false; }
    }

    function storageRemove(key) {
      try { localStorage.removeItem(key); } catch (_) {}
    }

    function registerWindow(win, isPrimary = false) {
      if (!win || windows.has(win)) return;
      const id = (win.crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(36).slice(2)));
      const key = prefix + id;
      const update = () => {
        let active = false;
        try {
          active = win.document.visibilityState === "visible" && win.document.hasFocus();
        } catch (_) {}
        storageSet(key, { at: Date.now(), active });
        return active;
      };
      const remove = event => {
        if (event?.persisted) {
          storageSet(key, { at: Date.now(), active: false });
          sync(true);
          return;
        }
        storageRemove(key);
        windows.delete(win);
        sync(true);
      };
      const onState = () => sync();
      try {
        win.document.addEventListener("visibilitychange", onState);
        win.addEventListener("focus", onState);
        win.addEventListener("blur", onState);
        win.addEventListener("pageshow", update);
        win.addEventListener("pagehide", remove);
      } catch (_) {}
      windows.set(win, { key, update, remove, onState, isPrimary });
      update();
    }

    function hasAnyVisibleWindow() {
      let found = false;
      const now = Date.now();
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith(prefix)) continue;
          let record = null;
          try { record = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) {}
          if (!record || !Number.isFinite(Number(record.at)) || now - Number(record.at) > RECORD_TTL_MS) {
            localStorage.removeItem(key);
            continue;
          }
          if (record.active === true) found = true;
        }
      } catch (_) {
        for (const win of windows.keys()) {
          try {
            if (win.document.visibilityState === "visible" && win.document.hasFocus()) return true;
          } catch (_) {}
        }
      }
      return found;
    }

    async function setServerPresence(present, changedAt) {
      if (stopped || pendingPresence === present || serverPresence === present) return;
      pendingPresence = present;
      try {
        await onPresenceChange(present, changedAt || Date.now());
        serverPresence = present;
      } catch (error) {
        console.warn("Could not update Study Room presence", error);
      } finally {
        pendingPresence = null;
      }
    }

    function pulse() {
      if (stopped || typeof onPulse !== "function") return;
      if (Date.now() - lastPulseAt < PULSE_MS) return;
      lastPulseAt = Date.now();
      Promise.resolve(onPulse()).catch(error => console.warn("Study Room presence heartbeat failed", error));
    }

    function sync(fromPageHide = false) {
      if (stopped) return;
      for (const [win, record] of windows) {
        try {
          if (win.closed) {
            storageRemove(record.key);
            windows.delete(win);
          } else {
            record.update();
          }
        } catch (_) {
          storageRemove(record.key);
          windows.delete(win);
        }
      }

      if (hasAnyVisibleWindow()) {
        if (awayTimer) {
          clearTimeout(awayTimer);
          awayTimer = null;
        }
        const gapStart = noActiveSince;
        noActiveSince = null;
        if (gapStart != null && Date.now() - gapStart >= AWAY_GRACE_MS && serverPresence !== false) {
          const graceExpiredAt = gapStart + AWAY_GRACE_MS;
          setServerPresence(false, graceExpiredAt).then(() => setServerPresence(true, Date.now()));
        } else {
          setServerPresence(true, Date.now());
        }
        pulse();
        return;
      }

      if (fromPageHide) {
        if (awayTimer) clearTimeout(awayTimer);
        awayTimer = null;
        const closedAt = Date.now();
        noActiveSince = closedAt;
        if (typeof onUnloadAway === "function") {
          try { onUnloadAway(closedAt); } catch (error) { console.warn("Unload presence request failed", error); }
        } else {
          setServerPresence(false, closedAt);
        }
        return;
      }

      if (noActiveSince == null) noActiveSince = Date.now();
      if (!awayTimer) {
        const graceExpiredAt = noActiveSince + AWAY_GRACE_MS;
        awayTimer = setTimeout(() => {
          awayTimer = null;
          if (!hasAnyVisibleWindow()) setServerPresence(false, graceExpiredAt);
          else sync();
        }, Math.max(0, graceExpiredAt - Date.now()));
      }
    }

    registerWindow(window, true);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    sync();
    syncTimer = setInterval(sync, 10000);

    return {
      addWindow(win) {
        registerWindow(win, false);
        sync();
      },
      refresh() { sync(); },
      stop() {
        stopped = true;
        if (awayTimer) clearTimeout(awayTimer);
        if (syncTimer) clearInterval(syncTimer);
        window.removeEventListener("storage", onStorage);
        for (const [win, record] of windows) {
          try {
            win.document.removeEventListener("visibilitychange", record.onState);
            win.removeEventListener("focus", record.onState);
            win.removeEventListener("blur", record.onState);
            win.removeEventListener("pageshow", record.update);
            win.removeEventListener("pagehide", record.remove);
          } catch (_) {}
          storageRemove(record.key);
        }
        windows.clear();
      }
    };
  }

  window.StudyRoomPresence = { start };
})();