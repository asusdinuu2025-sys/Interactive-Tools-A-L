/* =========================================================
   STUDY LAB — LIVE LAYER
   Shared Supabase client + Realtime presence.
   The countdown works without any external service.
   ========================================================= */

(function () {
  "use strict";

  const liveRoot = document.querySelector("[data-live-layer]");
  const onlineNumber = liveRoot?.querySelector("[data-live-online]");
  const liveStatus = liveRoot?.querySelector("[data-live-status]");
  const countdownYear = liveRoot?.querySelector("[data-cd-year]");
  const countdownTargets = {
    "2027": "2027-08-01T00:00:00+05:30",
    "2028": "2028-08-01T00:00:00+05:30"
  };
  let countdownTarget = liveRoot?.dataset.countdownTarget;
  let yearPickedManually = false;

  const countdown = {
    days: liveRoot?.querySelector("[data-cd-days]"),
    hours: liveRoot?.querySelector("[data-cd-hours]"),
    minutes: liveRoot?.querySelector("[data-cd-minutes]"),
    seconds: liveRoot?.querySelector("[data-cd-seconds]")
  };

  function updateCountdown() {
    if (!countdownTarget) return;

    const target = new Date(countdownTarget).getTime();
    if (!Number.isFinite(target)) return;

    const diff = target - Date.now();
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

    const note = liveRoot?.querySelector("[data-countdown-note]");
    if (note) note.textContent = diff <= 0
      ? "A/L " + (countdownYear?.value || "2027") + " countdown target reached."
      : "";
  }

  function setCountdownYear(year) {
    const resolved = year === "2028" ? "2028" : "2027";
    countdownTarget = countdownTargets[resolved];
    if (liveRoot) liveRoot.dataset.countdownTarget = countdownTarget;
    if (countdownYear) {
      countdownYear.value = resolved;
      countdownYear.title = "Planning target: 1 August " + resolved +
        " (not a confirmed official examination date)";
    }
    updateCountdown();
  }

  countdownYear?.addEventListener("change", () => {
    yearPickedManually = true;
    setCountdownYear(countdownYear.value);
  });
  // Profile defaults are loaded from the existing account service.
  // A student who selects 2028 at signup sees 2028 automatically, while
  // missing/Other/2026/2029 values safely default to the 2027 timer.
  async function syncYearFromProfile() {
    const account = window.StudyLabAccount;
    if (!account?.ready || !account?.getProfile) return;
    try {
      await account.ready;
      const profile = await account.getProfile();
      if (!yearPickedManually) setCountdownYear(String(profile?.exam_year || ""));
    } catch (error) {
      console.warn("StudyLab countdown profile year unavailable:", error);
    }
  }
  window.addEventListener("studylab-profile-updated", event => {
    yearPickedManually = false;
    setCountdownYear(String(event.detail?.exam_year || ""));
  });
  setCountdownYear("2027");
  void syncYearFromProfile();
  window.setInterval(updateCountdown, 1000);

  function showLiveMessage(message) {
    if (liveStatus) liveStatus.textContent = message;
  }

  function setOnlineCount(count) {
    if (!onlineNumber) return;

    if (!Number.isFinite(count)) {
      onlineNumber.textContent = "—";
      liveRoot?.classList.remove("is-low", "is-live");
      return;
    }

    const safeCount = Math.max(0, Math.floor(count));
    onlineNumber.textContent = safeCount.toLocaleString();
    liveRoot?.classList.toggle("is-low", safeCount < 2);
    liveRoot?.classList.toggle("is-live", safeCount >= 2);
  }

  async function startPresence() {
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("StudyLab account unavailable.");

      await account.ready;

      const client = account.client;
      const user = account.getUser?.();

      if (
        !client ||
        !user?.id ||
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
      ) {
        throw new Error("Supabase client unavailable.");
      }

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
        const userIds = new Set();

        Object.values(state).forEach(entries => {
          (entries || []).forEach(entry => {
            if (entry?.user_id) userIds.add(entry.user_id);
          });
        });

        const count = userIds.size || Object.keys(state).length;
        setOnlineCount(count);
        showLiveMessage(
          count === 1
            ? "1 student currently online"
            : count + " students currently online"
        );
      }

      channel
        .on("presence", { event: "sync" }, refreshPresence)
        .subscribe(async status => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              user_id: user.id,
              page: location.pathname,
              device_type: window.StudyLabWorkspace?.deviceType(navigator)||"unknown",
              online_at: new Date().toISOString()
            });
            refreshPresence();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setOnlineCount(NaN);
            showLiveMessage("Live connection unavailable right now.");
          }
        });

      window.addEventListener("pagehide", () => {
        channel.untrack().catch(() => {});
      });
    } catch (error) {
      console.warn("StudyLab Live:", error);
      setOnlineCount(NaN);
      showLiveMessage("Live connection unavailable right now.");
    }
  }

  startPresence();
})();
