/* Independent StudyLab timer window. Keeps its own heartbeat after the main tab closes. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const clock = $("clock"), status = $("status");
  const startButton = $("start"), pauseButton = $("pause"), endButton = $("end");
  let client = null, userId = null, row = null, heartbeatRetry = null, heartbeatBusy = false;
  let unloadPauseRequest = null, unloadPauseRequested = false;

  let accessToken = null;
  let presenceController = null;

  function sendUnloadPresenceAway() {
    let url = String(window.STUDYLAB_SUPABASE_URL || "");
    while (url.endsWith("/")) url = url.slice(0, -1);
    const apiKey = window.STUDYLAB_SUPABASE_ANON_KEY;
    if (!url || !apiKey || !accessToken) return;
    try {
      window.fetch(url + "/rest/v1/rpc/study_room_presence", {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_is_present: false }),
        keepalive: true,
        credentials: "omit"
      }).catch(error => console.warn("Detached timer unload presence request failed", error));
    } catch (error) {
      console.warn("Could not send detached timer unload presence request", error);
    }
  }

  function startPresenceLifecycle() {
    if (presenceController || !window.StudyRoomPresence) return;
    presenceController = window.StudyRoomPresence.start({
      userId,
      onPresenceChange: async present => {
        await rpc("study_room_presence", { p_is_present: present });
        await loadRow();
      },
      onPulse: heartbeat,
      onUnloadAway: sendUnloadPresenceAway
    });
  }

  const HEARTBEAT_MS = 20000;
  const dayKey = date => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
  const fmt = seconds => {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
      .map(n => String(n).padStart(2, "0")).join(":");
  };
  function pendingSeconds() {
    const present = Boolean(row?.is_studying && row?.session_presence_state === "present");
    const away = Boolean(row?.session_active && row?.session_presence_state === "away" && row?.last_heartbeat_at);
    if ((!present && !away) || !row.last_heartbeat_at) return 0;
    const heartbeatAt = new Date(row.last_heartbeat_at).getTime();
    const todayStart = new Date(dayKey(new Date()) + "T00:00:00+05:30").getTime();
    if (!Number.isFinite(heartbeatAt) || !Number.isFinite(todayStart)) return 0;
    let elapsed = Math.max(0, Math.floor((Date.now() - Math.max(heartbeatAt, todayStart)) / 1000));
    if (away) {
      const base = Math.max(0, Number(row.session_elapsed_seconds) || 0);
      const target = Number(row.session_target_seconds) || 43200;
      elapsed = Math.min(elapsed, Math.max(0, target - base));
    }
    return elapsed;
  }
  function render() {
    const active = Boolean(row?.is_studying && row?.session_presence_state === "present");
    const away = Boolean(row?.session_active && row?.session_presence_state === "away");
    const hasSession = Boolean(row?.session_active);
    const base = row && (row.session_active || row.is_studying)
      ? Math.max(0, Number(row.session_elapsed_seconds) || 0) : 0;
    clock.textContent = fmt(base + pendingSeconds());
    status.textContent = row
      ? (active ? "Studying" : away ? "Away · counting to target" : hasSession ? "Paused" : "Not studying") +
        (row.subject ? " · " + row.subject : "")
      : "No active Study Room profile";
    startButton.disabled = !row || active || away || !hasSession;
    pauseButton.disabled = !row || !active;
    endButton.disabled = !row || !hasSession;
  }
  async function loadRow() {
    const { data, error } = await client.from("study_room_live").select(
      "user_id,subject,is_studying,session_active,session_elapsed_seconds,session_date,last_heartbeat_at,updated_at,session_presence_state,session_target_seconds,session_target_reached_at,session_away_since_at,session_away_pending_seconds"
    ).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    row = data || null;
    render();
  }
  async function rpc(name, args) {
    const { error } = await client.rpc(name, args || {});
    if (error) throw error;
  }
  function heartbeatWasRecentlySuccessful() {
    try {
      const key = "studylab:study-room-heartbeat:" + userId;
      return Date.now() - Number(localStorage.getItem(key) || 0) < 15000;
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
      if (action === "start" && !row?.session_active) {
        status.textContent = "Choose a subject and target time in the Live Study Room before starting a new session.";
        render();
        return;
      }
      await rpc("study_room_" + action, action === "start"
        ? { p_target_seconds: Number(row?.session_target_seconds) || 43200 }
        : undefined);
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
      await loadRow();
      startPresenceLifecycle();
      client.channel("study-room-independent-timer")
        .on("postgres_changes", { event: "*", schema: "public", table: "study_room_members" }, () => {
          loadRow().catch(error => console.error("Mini timer refresh failed", error));
        }).subscribe();
      startButton.addEventListener("click", () => run("start"));
      pauseButton.addEventListener("click", () => run("pause"));
      endButton.addEventListener("click", () => run("end"));
      $("close").addEventListener("click", () => window.close());
      window.addEventListener("online", () => heartbeat());
      window.addEventListener("online", () => {
        presenceController?.refresh();
        heartbeat();
        loadRow().catch(error => console.error("Mini timer reconnect refresh failed", error));
      });
      if (!window.StudyRoomPresence) setInterval(heartbeat, HEARTBEAT_MS);
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
