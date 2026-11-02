/* Independent StudyLab timer window. Keeps its own heartbeat after the main tab closes. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const clock = $("clock"), status = $("status");
  const startButton = $("start"), pauseButton = $("pause"), endButton = $("end");
  let client = null, userId = null, row = null, heartbeatRetry = null, heartbeatBusy = false;
  const HEARTBEAT_MS = 60000;
  const TIMEOUT_MS = 90000;
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
    const age = Date.now() - new Date(row.last_heartbeat_at).getTime();
    if (!Number.isFinite(age) || age >= TIMEOUT_MS) return 0;
    return Math.min(90, Math.max(0, Math.floor(age / 1000)));
  }
  function render() {
    // The server-side view already applies the authoritative 90-second timeout.
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
      return Date.now() - Number(localStorage.getItem(key) || 0) < 45000;
    } catch (_) { return false; }
  }
  async function heartbeat(isRetry = false) {
    if (!row?.is_studying || heartbeatBusy) return;
    if (!isRetry && heartbeatWasRecentlySuccessful()) return;
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
        if (document.visibilityState === "visible") heartbeat();
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
