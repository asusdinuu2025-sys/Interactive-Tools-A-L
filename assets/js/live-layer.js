/* =========================================================
   STUDY LAB — LIVE LAYER
   Requires Supabase Realtime for the online count.
   The countdown itself works without any external service.
   ========================================================= */

(function () {
  "use strict";

  const liveRoot = document.querySelector("[data-live-layer]");
  if (!liveRoot) return;

  const onlineNumber = liveRoot.querySelector("[data-live-online]");
  const liveStatus = liveRoot.querySelector("[data-live-status]");
  const countdownTarget = liveRoot.dataset.countdownTarget;
  const countdown = {
    days: liveRoot.querySelector("[data-cd-days]"),
    hours: liveRoot.querySelector("[data-cd-hours]"),
    minutes: liveRoot.querySelector("[data-cd-minutes]"),
    seconds: liveRoot.querySelector("[data-cd-seconds]")
  };

  /* =========================================================
     A/L 2027 COUNTDOWN
     The official 2027 A/L exam date is not configured here
     yet. The homepage currently uses 01 August 2027 as a
     clearly labelled target. Update the data attribute in
     index.html when the official timetable is published.
     ========================================================= */

  function updateCountdown() {
    if (!countdownTarget) return;

    const target = new Date(countdownTarget).getTime();
    const now = Date.now();
    const diff = target - now;

    if (!Number.isFinite(target)) return;

    const remaining = Math.max(0, diff);
    const totalSeconds = Math.floor(remaining / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (countdown.days) countdown.days.textContent = String(days);
    if (countdown.hours) countdown.hours.textContent = String(hours).padStart(2, "0");
    if (countdown.minutes) countdown.minutes.textContent = String(minutes).padStart(2, "0");
    if (countdown.seconds) countdown.seconds.textContent = String(seconds).padStart(2, "0");

    if (diff <= 0) {
      const note = liveRoot.querySelector("[data-countdown-note]");
      if (note) note.textContent = "A/L 2027 countdown target reached.";
    }
  }

  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  /* =========================================================
     REAL-TIME ONLINE PRESENCE
     Fill in the two Supabase values below after creating the
     project. A publishable key is safe to use in browser code;
     NEVER put a secret/service-role key here.
     ========================================================= */

  const SUPABASE_URL = "YOUR_SUPABASE_URL";
  const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

  function showLiveMessage(message) {
    if (liveStatus) liveStatus.textContent = message;
  }

  function setOnlineCount(count) {
    if (!onlineNumber) return;

    if (typeof count !== "number" || !Number.isFinite(count)) {
      onlineNumber.textContent = "—";
      liveRoot.classList.remove("is-low", "is-live");
      return;
    }

    const safeCount = Math.max(0, Math.floor(count));
    onlineNumber.textContent = safeCount.toLocaleString();

    liveRoot.classList.toggle("is-low", safeCount < 10);
    liveRoot.classList.toggle("is-live", safeCount >= 10);
  }

  if (
    SUPABASE_URL.startsWith("YOUR_") ||
    SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_") ||
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    setOnlineCount("—");
    showLiveMessage("Live connection is ready to configure.");
    return;
  }

  try {
    const client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    const sessionKey =
      sessionStorage.getItem("studylab_live_session") ||
      (window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : "guest-" + Date.now() + "-" + Math.random().toString(36).slice(2));

    sessionStorage.setItem("studylab_live_session", sessionKey);

    const channel = client.channel("studylab-live", {
      config: {
        presence: {
          key: sessionKey
        }
      }
    });

    function refreshPresence() {
      const state = channel.presenceState();
      const uniqueKeys = new Set(Object.keys(state));
      const count = uniqueKeys.size;

      setOnlineCount(count);

      showLiveMessage(
        count === 1
          ? "1 student currently online"
          : count + " students currently online"
      );
    }

    channel
      .on("presence", { event: "sync" }, refreshPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            page: location.pathname,
            online_at: new Date().toISOString()
          });
          refreshPresence();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setOnlineCount("—");
          showLiveMessage("Live connection unavailable right now.");
        }
      });

    window.addEventListener("pagehide", () => {
      channel.untrack().catch(() => {});
    });
  } catch (error) {
    console.warn("StudyLab Live:", error);
    setOnlineCount("—");
    showLiveMessage("Live connection unavailable right now.");
  }
})();