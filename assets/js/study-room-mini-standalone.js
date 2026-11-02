/* Independent StudyLab timer window. Keeps its own heartbeat after the main tab closes. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const clock = $("clock"), status = $("status");
  const startButton = $("start"), pauseButton = $("pause"), endButton = $("end");
  let client = null, userId = null, row = null, heartbeatRetry = null, heartbeatBusy = false;

  // Keep a per-user list of open Study Room pages so closing one tab does not
  // pause a session that is still open in another tab or the detached timer.
  const ROOM_PAGE_PRESENCE_TTL_MS = 12 * 60 * 60 * 1000;
  let roomPagePresencePrefix = null;
  let roomPagePresenceKey = null;
  let roomPagePresenceInterval = null;
  let accessToken = null;
  let roomPagePresenceStorageAvailable = true;

  function registerRoomPagePresence() {
    if (!userId) return;
    roomPagePresencePrefix = "studylab:study-room-open:" + userId + ":";
    if (!roomPagePresenceKey) {
      const pageId = window.crypto?.randomUUID?.() ||
        (Date.now() + "-" + Math.random().toString(36).slice(2));
      roomPagePresenceKey = roomPagePresencePrefix + pageId;
    }
    try {
      localStorage.setItem(roomPagePresenceKey, String(Date.now()));
      roomPagePresenceStorageAvailable = true;
    } catch (error) {
      roomPagePresenceStorageAvailable = false;
      console.warn("Study Room page-presence storage is unavailable", error);
    }
  }

  function hasAnotherRoomPageOpen() {
    // If storage cannot be checked safely, do not risk pausing another open page.
    if (!roomPagePresencePrefix || !roomPagePresenceStorageAvailable) return true;
    const cutoff = Date.now() - ROOM_PAGE_PRESENCE_TTL_MS;
    let anotherPageOpen = false;
    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(roomPagePresencePrefix) || key === roomPagePresenceKey) continue;
        const lastSeen = Number(localStorage.getItem(key));
        if (!Number.isFinite(lastSeen) || lastSeen < cutoff) {
          localStorage.removeItem(key);
        } else {
          anotherPageOpen = true;
        }
      }
    } catch (error) {
      roomPagePresenceStorageAvailable = false;
      console.warn("Could not inspect other Study Room pages", error);
      return true;
    }
    return anotherPageOpen;
  }

  function pauseWhenLastRoomPageCloses(event) {
    // A page in the back/forward cache is frozen, not terminated.
    if (event?.persisted || !roomPagePresenceKey) return;
    try { localStorage.removeItem(roomPagePresenceKey); } catch (_) { roomPagePresenceStorageAvailable = false; }
    if (hasAnotherRoomPageOpen()) return;

    let url = String(window.STUDYLAB_SUPABASE_URL || "");
    while (url.endsWith("/")) url = url.slice(0, -1);
    const apiKey = window.STUDYLAB_SUPABASE_ANON_KEY;
    if (!url || !apiKey || !accessToken) return;

    // Best effort: keepalive lets the pause RPC finish while the page unloads.
    // If the browser is killed without a lifecycle event, the 12-hour server
    // fallback handles the abandoned session instead.
    try {
      window.fetch(url + "/rest/v1/rpc/study_room_pause", {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json"
        },
        body: "{}",
        keepalive: true,
        credentials: "omit"
      }).catch(error => console.warn("Study Room close-pause request failed", error));
    } catch (error) {
      console.warn("Could not send Study Room close-pause request", error);
    }
  }

  function startRoomPagePresenceLifecycle() {
    registerRoomPagePresence();
    if (!roomPagePresenceInterval) {
      roomPagePresenceInterval = window.setInterval(registerRoomPagePresence, 60000);
    }
    window.addEventListener("pagehide", pauseWhenLastRoomPageCloses);
    window.addEventListener("pageshow", event => {
      if (event.persisted) registerRoomPagePresence();
    });
  }

  const HEARTBEAT_MS = 60000;
  const dayKey = date => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
  const fmt = seconds => {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
      .map(n => String(n).padStart(2, "0")).join(":");
  };
  function pendingSeconds() {
    if (!row?.is_studying || !row.last_heartbeat_at) return 0;
    const heartbeatAt = new Date(row.last_heartbeat_at).getTime();
    const todayStart = new Date(dayKey(new Date()) + "T00:00:00+05:30").getTime();
    if (!Number.isFinite(heartbeatAt) || !Number.isFinite(todayStart)) return 0;
    return Math.max(0, Math.floor((Date.now() - Math.max(heartbeatAt, todayStart)) / 1000));
  }
  function render() {
    // The server-side view expires abandoned sessions after 12 hours.
    const active = Boolean(row?.is_studying && row.last_heartbeat_at);
    const hasSession = Boolean(row?.session_active);
    const base = row && (row.session_active || row.is_studying)
      ? Math.max(0, Number(row.session_elapsed_seconds) || 0) : 0;
    clock.textContent = fmt(base + (active ? pendingSeconds() : 0));
    status.textContent = row
      ? (active ? "Studying" : hasSession ? "Paused" : "Not studying") + (row.subject ? " · " + row.subject : "")
      : "No active Study Room profile";
    startButton.disabled = !row || active;
    pauseButton.disabled = !row || !active;
    endButton.disabled = !row || !hasSession;
  }
  async function loadRow() {
    const { data, error } = await client.from("study_room_live").select(
      "user_id,subject,is_studying,session_active,session_elapsed_seconds,session_date,last_heartbeat_at,updated_at"
    ).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    row = data || null;
    render();
  }
  async function rpc(name) {
    const { error } = await client.rpc(name);
    if (error) throw error;
  }
  function heartbeatWasRecentlySuccessful() {
    try {
      const key = "studylab:study-room-heartbeat:" + userId;
      return Date.now() - Number(localStorage.getItem(key) || 0) < 55000;
    } catch (_) { return false; }
  }
  async function heartbeat(isRetry = false) {
    if (!row?.is_studying || heartbeatBusy) return;
    if (heartbeatWasRecentlySuccessful()) {
      try { await loadRow(); }
      catch (error) { console.error("Detached timer refresh failed", error); }
      return;
    }
    heartbeatBusy = true;
    try {
      await rpc("study_room_heartbeat");
      try { localStorage.setItem("studylab:study-room-heartbeat:" + userId, String(Date.now())); } catch (_) {}
      if (heartbeatRetry) { clearTimeout(heartbeatRetry); heartbeatRetry = null; }
      await loadRow();
    } catch (error) {
      console.error("Independent StudyLab timer heartbeat failed", error);
      if (!isRetry && !heartbeatRetry) {
        heartbeatRetry = setTimeout(() => {
          heartbeatRetry = null;
          heartbeat(true);
        }, 15000);
      }
    } finally {
      heartbeatBusy = false;
    }
  }
  async function run(action) {
    if (!client || !userId) return;
    [startButton, pauseButton, endButton].forEach(button => { button.disabled = true; });
    try {
      await rpc("study_room_" + action);
      await loadRow();
      if (action === "start") await heartbeat();
    } catch (error) {
      status.textContent = error.message || "Could not update the study session.";
      render();
    }
  }
  async function init() {
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("StudyLab account is unavailable.");
      await account.ready;
      client = account.client;
      const user = account.getUser?.();
      if (!client || !user?.id) throw new Error("Sign in to StudyLab in this browser first.");
      userId = user.id;
      const {data: sessionData, error: sessionError} = await client.auth.getSession();
      if (sessionError) throw sessionError;
      accessToken = sessionData?.session?.access_token || null;
      client.auth.onAuthStateChange((_event, session) => {
        accessToken = session?.access_token || null;
      });
      startRoomPagePresenceLifecycle();
      await loadRow();
      client.channel("study-room-independent-timer")
        .on("postgres_changes", { event: "*", schema: "public", table: "study_room_members" }, () => {
          loadRow().catch(error => console.error("Mini timer refresh failed", error));
        }).subscribe();
      startButton.addEventListener("click", () => run("start"));
      pauseButton.addEventListener("click", () => run("pause"));
      endButton.addEventListener("click", () => run("end"));
      $("close").addEventListener("click", () => window.close());
      window.addEventListener("online", () => heartbeat());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") { registerRoomPagePresence(); heartbeat(); }
      });
      setInterval(heartbeat, HEARTBEAT_MS);
      setInterval(render, 1000);
      await heartbeat();
    } catch (error) {
      status.textContent = error.message || "Could not connect to StudyLab.";
      console.error("Independent StudyLab timer setup failed", error);
    }
  }
  render();
  init();
})();
