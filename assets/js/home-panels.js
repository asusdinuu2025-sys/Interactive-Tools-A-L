/* StudyLab Home panels: read-only live Study Room ranks + Social drawer launcher. */
(() => {
  "use strict";
  const rankRoot = document.querySelector("[data-home-room-ranks]");
  const socialButton = document.querySelector("[data-open-home-social]");

  socialButton?.addEventListener("click", () => {
    document.querySelector(".sl-feed-toggle")?.click();
  });

  if (!rankRoot) return;
  const todayName = rankRoot.querySelector("[data-home-rank-today-name]");
  const todayTime = rankRoot.querySelector("[data-home-rank-today-time]");
  const weekName = rankRoot.querySelector("[data-home-rank-week-name]");
  const weekTime = rankRoot.querySelector("[data-home-rank-week-time]");
  const fallbackName = "No ranking recorded yet";

  const dayKey = date => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
  const weekStart = date => {
    const [year, month, day] = dayKey(date).split("-").map(Number);
    const monday = new Date(Date.UTC(year, month - 1, day));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  };
  const startOfDay = key => new Date(key + "T00:00:00+05:30").getTime();
  const duration = seconds => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (total > 0 && total < 60) return "<1m";
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return hours ? hours + "h" + (minutes ? " " + minutes + "m" : "") : minutes + "m";
  };
  function pendingSeconds(row, boundary) {
    const present = Boolean(row?.is_studying && row?.last_heartbeat_at);
    const away = Boolean(row?.session_active && row?.session_presence_state === "away" && row?.last_heartbeat_at);
    if (!present && !away) return 0;
    const heartbeatAt = new Date(row.last_heartbeat_at).getTime();
    if (!Number.isFinite(heartbeatAt)) return 0;
    let elapsed = Math.max(0, Math.floor((Date.now() - Math.max(heartbeatAt, boundary)) / 1000));
    if (away) {
      const base = Math.max(0, Number(row.session_elapsed_seconds) || 0);
      const target = Number(row.session_target_seconds) || 43200;
      elapsed = Math.min(elapsed, Math.max(0, target - base));
    }
    return elapsed;
  }
  function showUnavailable(message) {
    [todayName, weekName].forEach(el => { if (el) el.textContent = message; });
    [todayTime, weekTime].forEach(el => { if (el) el.textContent = "Live ranking unavailable right now"; });
    rankRoot.dataset.rankState = "unavailable";
  }
  function renderRank(rows, period) {
    const isToday = period === "today";
    const expected = isToday ? dayKey(new Date()) : weekStart(new Date());
    const field = isToday ? "today_seconds" : "week_seconds";
    const bucket = isToday ? "today_date" : "week_start";
    const boundary = startOfDay(expected);
    const ranked = (rows || []).map(row => ({
      row,
      score: (row[bucket] === expected ? Number(row[field]) || 0 : 0) +
        ((row.is_studying || row.session_presence_state === "away") ? pendingSeconds(row, boundary) : 0)
    })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    return ranked[0] || null;
  }
  function render(rows) {
    const today = renderRank(rows, "today");
    const week = renderRank(rows, "week");
    if (todayName) todayName.textContent = today?.row?.display_name || fallbackName;
    if (todayTime) todayTime.textContent = today ? duration(today.score) + " focused today" : "The daily leaderboard updates as students study";
    if (weekName) weekName.textContent = week?.row?.display_name || fallbackName;
    if (weekTime) weekTime.textContent = week ? duration(week.score) + " focused this week" : "The weekly leaderboard updates as students study";
    rankRoot.dataset.rankState = "live";
    rankRoot.dataset.updatedAt = new Date().toISOString();
  }

  (async () => {
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("StudyLab account is not ready");
      await account.ready;
      const client = account.client;
      if (!client) throw new Error("Study Room data client is unavailable");
      const columns = "user_id,display_name,gender,subject,is_studying,session_active,session_started_at,session_elapsed_seconds,session_date,last_heartbeat_at,today_seconds,today_date,week_seconds,week_start,updated_at,session_expired_at,session_presence_state,session_target_seconds,session_target_reached_at,session_away_since_at,session_away_pending_seconds";
      let refreshing = false;
      const refresh = async () => {
        if (refreshing) return;
        refreshing = true;
        try {
          const { data, error } = await client.from("study_room_live").select(columns);
          if (error) throw error;
          render(data || []);
        } catch (error) {
          console.warn("Could not refresh Home Study Room rankings", error);
          showUnavailable("Live ranking unavailable right now");
        } finally {
          refreshing = false;
        }
      };
      await refresh();
      try {
        client.channel("home-study-room-leaderboard")
          .on("postgres_changes", { event: "*", schema: "public", table: "study_room_members" }, refresh)
          .subscribe();
      } catch (error) {
        console.warn("Home leaderboard realtime subscription unavailable", error);
      }
      window.setInterval(refresh, 60000);
    } catch (error) {
      console.warn("Home Study Room rankings could not start", error);
      showUnavailable("Live ranking unavailable right now");
    }
  })();
})();