/* StudyLab shared Study Room. Requires Supabase URL/key and anonymous sign-in enabled. */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.STUDYLAB_SUPABASE_URL && window.STUDYLAB_SUPABASE_ANON_KEY;
  const notice = $('roomNotice');
  const liveLabel = $('roomLiveLabel');
  const activeCount = $('activeCount');
  const weeklyHours = $('weeklyHours');
  const yourRank = $('yourRank');
  const status = $('yourStatus');
  const subject = $('studySubject');
  const targetHours = $('targetHours');
  const targetMinutes = $('targetMinutes');
  const targetHint = $('targetTimeHint');
  const timer = $('sessionTimer');
  const label = $('sessionLabel');
  const panel = $('sessionPanel');
  const join = $('joinStudy');
  const pause = $('pauseStudy');
  const leave = $('leaveStudy');
  const todayTotal = $('todayTotal');
  const goalBar = $('goalProgressBar');
  const goalText = $('goalProgressText');
  const people = $('peopleGrid');
  const board = $('leaderboardList');
  const dailyTab = $('dailyBoardTab');
  const weeklyTab = $('weeklyBoardTab');
  let client, userId = null, member = null, rows = [], heartbeatInterval = null, uiInterval = null, rankRefreshInterval = null;
  let heartbeatRetryTimer = null, heartbeatPromise = null, presenceController = null, hadActiveSession = false, sessionAction = null;
  let lastFullSyncAt = 0, fullSyncTimer = null;

  let accessToken = null;

  function sendUnloadPresenceAway(transitionAt) {
    let url = String(window.STUDYLAB_SUPABASE_URL || "");
    while (url.endsWith("/")) url = url.slice(0, -1);
    const apiKey = window.STUDYLAB_SUPABASE_ANON_KEY;
    if (!url || !apiKey || !accessToken) return;
    try {
      window.fetch(url + "/rest/v1/rpc/study_room_presence_at", {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_is_present: false, p_transition_at: new Date(transitionAt || Date.now()).toISOString() }),
        keepalive: true,
        credentials: "omit"
      }).catch(error => console.warn("Study Room unload presence request failed", error));
    } catch (error) {
      console.warn("Could not send Study Room unload presence request", error);
    }
  }

  function startRoomPresenceLifecycle() {
    if (presenceController || !window.StudyRoomPresence) return;
    presenceController = window.StudyRoomPresence.start({
      userId,
      onPresenceChange: async (present, changedAt) => {
        if (!client || !userId) return;
        await callRpc("study_room_presence_at", { p_is_present: present, p_transition_at: new Date(changedAt || Date.now()).toISOString() });
        await refreshOwnRow();
      },
      onPulse: heartbeat,
      onUnloadAway: sendUnloadPresenceAway
    });
    window.StudyRoomPresenceController = presenceController;
  }

  let selectedBoard = 'daily';
  const dayKey = date => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
  const weekStart = date => {
    const [year, month, day] = dayKey(date).split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const fmt = seconds => {
    seconds = Math.max(0, Math.floor(seconds || 0));
    return [Math.floor(seconds/3600), Math.floor(seconds%3600/60), seconds%60]
      .map(n => String(n).padStart(2,'0')).join(':');
  };
  const compact = seconds => fmt(seconds);
  const profileDuration = seconds => { const total=Math.max(0,Math.floor(Number(seconds)||0)); const hours=Math.floor(total/3600), minutes=Math.floor(total%3600/60); return hours ? hours+"h"+(minutes ? " "+minutes+"m" : "") : minutes+"m"; };
  const startOfDay = key => new Date(key + 'T00:00:00+05:30').getTime();
  // Present sessions may exceed their target; away sessions are capped server-side at the selected target.
  function heartbeatIsFresh(row) {
    return Boolean(row?.is_studying && row.last_heartbeat_at);
  }
  function pendingSeconds(row, boundary) {
    const present = heartbeatIsFresh(row);
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
  function isProfileComplete(p) {
    const phoneDigits = String(p?.phone || "").replace(/\D/g, "");
    return Boolean(p?.profile_completed_at && p?.display_name &&
      !/^Student\d{4}$/.test(String(p.display_name)) &&
      String(p?.school || "").trim().length >= 2 &&
      phoneDigits.length >= 9 && phoneDigits.length <= 12 &&
      p?.exam_year && p?.study_stream &&
      ["male", "female"].includes(p?.gender));
  }
  function setGenderIcon(element, gender) {
    if (!element) return;
    const kind = gender === "female" ? "female" : "male";
    element.classList.add("room-avatar-gender", "room-avatar-" + kind);
    element.setAttribute("aria-label", kind + " profile icon");
    element.style.setProperty('--slr-gender-neon', kind === "female" ? '#ff4fa3' : '#39a8ff');
    element.style.setProperty('color', kind === "female" ? '#ff4fa3' : '#39a8ff', 'important');
    element.innerHTML = kind === "female"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" style="color:#ff4fa3!important;stroke:#ff4fa3!important;filter:drop-shadow(0 0 2px #ff4fa3) drop-shadow(0 0 5px #ff4fa3)"><circle cx="12" cy="7" r="3.2"></circle><path d="M7 20l1-4.2a4.1 4.1 0 0 1 8 0l1 4.2z" style="stroke:#ff4fa3!important"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" style="color:#39a8ff!important;stroke:#39a8ff!important;filter:drop-shadow(0 0 2px #39a8ff) drop-shadow(0 0 5px #39a8ff)"><circle cx="12" cy="7" r="3.2"></circle><path d="M4.5 20v-2.5a7.5 7.5 0 0 1 15 0V20z" style="stroke:#39a8ff!important"></path></svg>';
  }
  function say(text, isError = false) {
    notice.textContent = text;
    notice.style.borderColor = isError ? 'rgba(255,105,105,.35)' : '';
    notice.style.color = isError ? '#ef4444' : '';
  }
  function selectedTargetSeconds() {
    const hoursValue = targetHours?.value;
    const minutesValue = targetMinutes?.value;
    if (hoursValue === "" || minutesValue === "" || hoursValue == null || minutesValue == null) return null;
    const hours = Number(hoursValue);
    const minutes = Number(minutesValue);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) ||
        hours < 0 || hours > 10 || minutes < 0 || minutes > 59) return null;
    const total = (hours * 60 + minutes) * 60;
    return total >= 60 && total <= 39540 ? total : null;
  }

  function refreshPersonalHistory() {
    try {
      const task = window.StudyRoomHistory?.refresh?.();
      if (task?.catch) task.catch(error => console.warn('Study Room history refresh failed', error));
    } catch (error) {
      console.warn('Could not request saved Study Room history', error);
    }
  }

  function clearTargetError() {
    [targetHours, targetMinutes].forEach(input => {
      if (!input) return;
      input.removeAttribute("aria-invalid");
      input.classList.remove("room-subject-required");
      input.style.removeProperty("border-color");
      input.style.removeProperty("box-shadow");
      input.style.removeProperty("color");
    });
    if (targetHint) targetHint.textContent = "Choose a target from 1 minute up to 10 hours 59 minutes.";
  }

  function showTargetError() {
    [targetHours, targetMinutes].forEach(input => {
      if (!input) return;
      input.setAttribute("aria-invalid", "true");
      input.style.setProperty("border-color", "#ef4444", "important");
      input.style.setProperty("box-shadow", "0 0 0 3px rgba(239,68,68,.18)", "important");
      input.style.setProperty("color", "#ef4444", "important");
    });
    if (targetHint) targetHint.textContent = "Please select a target time.";
    say("Please select a target time.", true);
    (targetHours?.value === "" ? targetHours : targetMinutes)?.focus();
  }

  function updatePersonal() {
    const today = dayKey(new Date());
    const todaySeconds = member && member.today_date === today ? Number(member.today_seconds) || 0 : 0;
    const pendingToday = pendingSeconds(member, startOfDay(today));
    todayTotal.textContent = "Today: " + fmt(todaySeconds + pendingToday);

    const savedSessionSeconds = member && (member.session_active || member.is_studying)
      ? Math.max(0, Number(member.session_elapsed_seconds) || 0) : 0;
    const liveSessionSeconds = pendingSeconds(member, 0);
    const elapsed = savedSessionSeconds + liveSessionSeconds;
    const target = member && (member.session_active || member.is_studying)
      ? Number(member.session_target_seconds) || 0
      : (selectedTargetSeconds() || 0);
    const percent = target > 0 ? Math.min(100, Math.round(elapsed / target * 100)) : 0;
    goalBar.style.width = percent + "%";
    goalText.textContent = target > 0
      ? (percent >= 100 ? "Target reached" : percent + "% of target")
      : "Choose a target time";
    timer.textContent = fmt(elapsed);
    emitTimerState();
  }

  function updateSessionUI(row) {
    // Inactive database rows retain the last subject. Do not pre-select it
    // for a new study session just because it was used yesterday.
    if (row?.session_active && row?.subject &&
        [...subject.options].some(option => option.value === row.subject)) {
      subject.value = row.subject;
    }
    const isRunning = Boolean(row?.is_studying);
    const isAway = Boolean(row?.session_active && row?.session_presence_state === "away");
    const hasSession = Boolean(row?.session_active);
    // Start begins a NEW session. Once paused, Pause becomes Continue.
    // Away sessions stay locked until presence is reconciled by the server.
    join.disabled = hasSession || isRunning || isAway || Boolean(sessionAction);
    pause.disabled = !hasSession || isAway || Boolean(sessionAction);
    leave.disabled = !hasSession || Boolean(sessionAction);
    targetHours.disabled = hasSession;
    targetMinutes.disabled = hasSession;
    if (hasSession && Number(row?.session_target_seconds) > 0) {
      const targetMinutesTotal = Math.floor(Number(row.session_target_seconds) / 60);
      const hoursValue = String(Math.floor(targetMinutesTotal / 60));
      const legacyOption = targetHours.querySelector('option[data-legacy-target="true"]');
      if (Number(hoursValue) > 10) {
        const option = legacyOption || document.createElement("option");
        option.value = hoursValue;
        option.textContent = hoursValue + " (existing session)";
        option.disabled = true;
        option.dataset.legacyTarget = "true";
        if (!legacyOption) targetHours.append(option);
      } else if (legacyOption) {
        legacyOption.remove();
      }
      targetHours.value = hoursValue;
      targetMinutes.value = String(targetMinutesTotal % 60);
      clearTargetError();
    } else if (!hasSession && hadActiveSession) {
      subject.value = '';
      targetHours.value = "";
      targetMinutes.value = "";
      targetHours.querySelector('option[data-legacy-target="true"]')?.remove();
    }
    hadActiveSession = hasSession;
    join.textContent = sessionAction === 'start' ? "Starting…" : "Start";
    pause.textContent = sessionAction === 'continue' ? "Continuing…" :
      sessionAction === 'pause' ? "Pausing…" :
      hasSession && !isRunning && !isAway ? "Continue" : "Pause";
    leave.textContent = "End";
    status.textContent = isAway ? "Away" : isRunning ? "Studying" : hasSession ? "Paused" : "Not studying";
    panel.classList.toggle("is-studying", isRunning);
    label.textContent = isAway
      ? "Away · timer continues until the selected target, then pauses"
      : isRunning
        ? "Studying " + (row?.subject || subject.value) + " · session in progress"
        : row?.session_target_reached_at && hasSession
          ? "Target reached · paused · resume before midnight to confirm away time"
          : hasSession ? "Paused · press Continue to resume" : "Not studying · select a subject and target to begin";
    liveLabel.textContent = "Live shared room";
    window.StudyRoomSubjectPicker?.sync?.();
    emitTimerState();
  }

  // Shared daily/weekly score calculation. Stable ties avoid a crown that
  // randomly jumps between accounts with the same number of seconds.
  function rankedRoomRows(period) {
    const daily = period === 'daily';
    const expected = daily ? dayKey(new Date()) : weekStart(new Date());
    const dateField = daily ? 'today_date' : 'week_start';
    const secondsField = daily ? 'today_seconds' : 'week_seconds';
    const boundary = startOfDay(expected);
    return rows.map(r => ({
      ...r,
      score: (r[dateField] === expected ? Math.max(0, Number(r[secondsField]) || 0) : 0) +
        pendingSeconds(r, boundary)
    })).sort((a, b) => b.score - a.score ||
      String(a.display_name || '').localeCompare(String(b.display_name || ''), 'en', {sensitivity:'base'}) ||
      String(a.user_id || '').localeCompare(String(b.user_id || '')));
  }
  function setLiveText(node, value) {
    const label = String(value ?? '');
    if (node && node.textContent !== label) node.textContent = label;
  }
  window.addEventListener("studylab:follow-error", event => {
    say(event.detail?.message || "Could not update following. Please retry.", true);
  });
  function renderPeople() {
    const active = rows.filter(r => heartbeatIsFresh(r) ||
      (r?.session_active && r?.session_presence_state === 'away'));
    setLiveText(activeCount, active.length);
    const own = rows.find(r => r.user_id === userId) || member;
    const rankedWeek = rankedRoomRows('weekly');
    const ownRank = rankedWeek.findIndex(r => r.user_id === userId);
    setLiveText(yourRank, ownRank < 0 ? '—' : '#' + (ownRank + 1));
    yourRank.title = ownRank >= 0
      ? 'Ranked by total study time this week among Study Room members'
      : 'Your rank appears after your Study Room record is available';
    const currentWeek = weekStart(new Date());
    const thisWeek = own && own.week_start === currentWeek ? Number(own.week_seconds) || 0 : 0;
    setLiveText(weeklyHours, profileDuration(thisWeek + pendingSeconds(own, startOfDay(currentWeek))));

    const today = dayKey(new Date()), boundary = startOfDay(today);
    const rankedToday = rankedRoomRows('daily');
    const dailyPositions = new Map(rankedToday.map((r, i) => [String(r.user_id), i + 1]));
    const crownId = rankedToday[0]?.score > 0 ? String(rankedToday[0].user_id) : null;
    if (active.length === 0) {
      let empty = people.querySelector('.room-empty');
      if (!empty || people.children.length !== 1) {
        empty = document.createElement('p');
        empty.className = 'room-empty';
        people.replaceChildren(empty);
      }
      setLiveText(empty, 'No one is studying right now. Be the first to start.');
      return;
    }
    people.querySelector('.room-empty')?.remove();
    const existing = new Map([...people.querySelectorAll('.room-person-card[data-user-id]')]
      .map(card => [card.dataset.userId, card]));
    const visible = new Set();
    active.sort((a,b) =>
      String(a.display_name || '').localeCompare(String(b.display_name || ''), 'en', {sensitivity:'base'}) ||
      String(a.user_id || '').localeCompare(String(b.user_id || '')));
    active.forEach((r, index) => {
      const id = String(r.user_id);
      visible.add(id);
      let card = existing.get(id);
      if (!card) {
        card = document.createElement('article');
        card.className = 'room-person-card';
        card.dataset.userId = id;
        card.innerHTML = "<div class='room-person-card-top'><div class='room-avatar'></div><div class='room-person-status-stack'><span class='room-person-status'>Studying now</span><div class='room-person-follow-slot'></div></div></div>" +
          "<div class='room-person-card-name-row'><div class='room-person-card-name'></div><span class='room-person-card-rank' title='Daily rank among all Study Room members'></span></div>" +
          "<div class='room-person-card-subject'></div><div class='room-person-card-divider'></div>" +
          "<div class='room-person-card-time-label'>Today's study time</div><div class='room-person-card-time'></div>";
        const neonPalette = [['#45ddff','#087da0'],['#b79aff','#7040c7'],['#55edb0','#08794e'],['#ffd166','#9a5b00'],['#ff83c8','#b21b70'],['#ff8b6b','#b83b22']];
        let hash = 0;
        for (let i=0; i<id.length; i++) hash = (hash*31 + id.charCodeAt(i)) | 0;
        const neon = neonPalette[Math.abs(hash) % neonPalette.length];
        const avatar = card.querySelector('.room-avatar');
        avatar.classList.add('slr-neon-avatar');
        avatar.style.setProperty('--slr-neon-dark', neon[0]);
        avatar.style.setProperty('--slr-neon-light', neon[1]);
      }
      // Small translucent follow button is independent of timer/ranking UI.
      // Never add one to your own card or create duplicates on live refresh.
      if (id !== userId && !card.querySelector('.sl-follow-btn')) {
        const followButton = window.StudyLabFollow?.makeButton(id,{compact:true});
        if (followButton) card.querySelector('.room-person-follow-slot')?.append(followButton);
      }
      const avatar = card.querySelector('.room-avatar');
      const gender = r.gender === 'female' ? 'female' : 'male';
      if (avatar.dataset.gender !== gender) {
        avatar.classList.remove('room-avatar-female','room-avatar-male');
        setGenderIcon(avatar, gender);
        avatar.dataset.gender = gender;
      }
      const hasCrown = id === crownId;
      avatar.classList.toggle('slr-crown-avatar', hasCrown);
      if (hasCrown) {
        const title = gender === 'female' ? 'Study Queen' : 'Study King';
        const crown = gender === 'female' ? '♕' : '♛';
        if (avatar.getAttribute('data-slr-crown') !== crown) avatar.setAttribute('data-slr-crown', crown);
        avatar.setAttribute('aria-label', gender + ' profile icon, ' + title + ', daily rank #1');
        avatar.title = title + ' · daily rank #1';
      } else {
        if (avatar.hasAttribute('data-slr-crown')) avatar.removeAttribute('data-slr-crown');
        avatar.setAttribute('aria-label', gender + ' profile icon');
        avatar.title = r.session_presence_state === 'away'
          ? 'Away · timer continues to target' : 'Studying now';
      }
      const number = dailyPositions.get(id);
      const badge = card.querySelector('.room-person-card-rank');
      setLiveText(badge, number ? '#' + number : '—');
      badge.classList.toggle('is-daily-leader', hasCrown);
      badge.setAttribute('aria-label', number ? 'Daily rank number ' + number : 'No daily rank');
      setLiveText(card.querySelector('.room-person-status'),
        r.session_presence_state === 'away' ? 'Away' : 'Studying now');
      const liveName = card.querySelector('.room-person-card-name');
      setLiveText(liveName, r.display_name || 'Student');
      window.StudyLabNameMark?.decorate(liveName, id);
      setLiveText(card.querySelector('.room-person-card-subject'), r.subject || '—');
      const saved = r.today_date === today ? Number(r.today_seconds) || 0 : 0;
      setLiveText(card.querySelector('.room-person-card-time'), profileDuration(saved + pendingSeconds(r, boundary)));
      if (people.children[index] !== card) people.insertBefore(card, people.children[index] || null);
    });
    for (const card of [...people.querySelectorAll('.room-person-card')]) {
      if (!visible.has(card.dataset.userId)) card.remove();
    }
  }
  function renderBoard() {
    const ranked = rankedRoomRows(selectedBoard);
    if (!ranked.length) {
      let empty = board.querySelector('.room-empty');
      if (!empty || board.children.length !== 1) {
        empty = document.createElement('p');
        empty.className = 'room-empty';
        board.replaceChildren(empty);
      }
      setLiveText(empty, 'The leaderboard will appear as students study.');
    } else {
      board.querySelector('.room-empty')?.remove();
      const existing = new Map([...board.querySelectorAll('.room-rank[data-user-id]')]
        .map(item => [item.dataset.userId, item]));
      const visible = new Set();
      ranked.forEach((r,i) => {
        const id = String(r.user_id);
        visible.add(id);
        let item = existing.get(id);
        if (!item) {
          item = document.createElement('div');
          item.className = 'room-rank';
          item.dataset.userId = id;
          item.innerHTML = "<span class='room-rank-number'></span><div class='room-avatar'></div>" +
            "<div class='room-rank-info'><strong></strong><span></span></div><span class='room-time'></span>";
        }
        const avatar = item.querySelector('.room-avatar');
        const gender = r.gender === 'female' ? 'female' : 'male';
        if (avatar.dataset.gender !== gender) {
          avatar.classList.remove('room-avatar-female','room-avatar-male');
          setGenderIcon(avatar, gender);
          avatar.dataset.gender = gender;
        }
        setLiveText(item.querySelector('.room-rank-number'), i+1);
        const rankName = item.querySelector('.room-rank-info strong');
        setLiveText(rankName, r.display_name || 'Student');
        window.StudyLabNameMark?.decorate(rankName, id);
        setLiveText(item.querySelector('.room-rank-info span'), r.subject || '—');
        setLiveText(item.querySelector('.room-time'), compact(r.score));
        if (board.children[i] !== item) board.insertBefore(item, board.children[i] || null);
      });
      for (const item of [...board.querySelectorAll('.room-rank')]) {
        if (!visible.has(item.dataset.userId)) item.remove();
      }
    }
    dailyTab.classList.toggle('active', selectedBoard === 'daily');
    weeklyTab.classList.toggle('active', selectedBoard === 'weekly');
    dailyTab.setAttribute('aria-pressed', String(selectedBoard === 'daily'));
    weeklyTab.setAttribute('aria-pressed', String(selectedBoard === 'weekly'));
  }
  // Heartbeats fetch only the student's record. The shared leaderboard is
  // refreshed on a coalesced realtime signal and a 60-second fallback.
  async function refreshOwnRow() {
    if (!client || !userId) return;
    const {data, error} = await client.from('study_room_live').select(
      'user_id,display_name,gender,subject,is_studying,session_active,session_started_at,session_elapsed_seconds,session_date,last_heartbeat_at,today_seconds,today_date,week_seconds,week_start,updated_at,session_expired_at,session_presence_state,session_target_seconds,session_target_reached_at,session_away_since_at,session_away_pending_seconds'
    ).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    rows = rows.filter(row => row.user_id !== userId);
    if (data) rows.push(data);
    member = data || null;
    updateSessionUI(member);
    renderPeople();
    renderBoard();
    updatePersonal();
  }
  function scheduleGlobalRefresh() {
    if (fullSyncTimer || !client) return;
    const delay = Math.max(1200, 20000 - (Date.now() - lastFullSyncAt));
    fullSyncTimer = setTimeout(() => {
      fullSyncTimer = null;
      loadRows().catch(error => console.error('Study Room shared refresh failed', error));
    }, delay);
  }
  async function loadRows() {
    const {data,error} = await client.from('study_room_live').select(
      'user_id,display_name,gender,subject,is_studying,session_active,session_started_at,session_elapsed_seconds,session_date,last_heartbeat_at,today_seconds,today_date,week_seconds,week_start,updated_at,session_expired_at,session_presence_state,session_target_seconds,session_target_reached_at,session_away_since_at,session_away_pending_seconds'
    );
    if (error) throw error;
    rows = data || [];
    lastFullSyncAt = Date.now();
    member = rows.find(r => r.user_id === userId) || null;
    updateSessionUI(member);
    renderPeople();
    renderBoard();
    updatePersonal();
  }
  async function callRpc(name, args) {
    const {error} = await client.rpc(name, args || {});
    if (error) throw error;
  }
  function heartbeatWasRecentlySuccessful() {
    try {
      const key = "studylab:study-room-heartbeat:" + userId;
      return Date.now() - Number(localStorage.getItem(key) || 0) < 15000;
    } catch (_) { return false; }
  }
  async function heartbeat(isRetry = false) {
    if (!client || !userId || !member?.is_studying) return;
    if (heartbeatWasRecentlySuccessful()) {
      try { await refreshOwnRow(); }
      catch (e) { console.error('Could not refresh shared Study Room timer state', e); }
      return;
    }
    if (heartbeatPromise) return heartbeatPromise;
    heartbeatPromise = (async () => {
      try {
        await callRpc('study_room_heartbeat');
        try { localStorage.setItem("studylab:study-room-heartbeat:" + userId, String(Date.now())); } catch (_) {}
        if (heartbeatRetryTimer) {
          clearTimeout(heartbeatRetryTimer);
          heartbeatRetryTimer = null;
        }
        await refreshOwnRow();
      } catch (e) {
        console.error('Study Room heartbeat failed', e);
        // One short retry for a transient network failure; the next normal
        // heartbeat remains on the regular 20-second schedule.
        if (!isRetry && !heartbeatRetryTimer) {
          heartbeatRetryTimer = setTimeout(() => {
            heartbeatRetryTimer = null;
            heartbeat(true);
          }, 15000);
        }
      } finally {
        heartbeatPromise = null;
      }
    })();
    return heartbeatPromise;
  }
  async function startStudy() {
    if (sessionAction) return;
    if (!subject.value) {
      subject.setAttribute("aria-invalid", "true");
      subject.classList.add("room-subject-required");
      subject.style.setProperty("border-color", "#ef4444", "important");
      subject.style.setProperty("box-shadow", "0 0 0 3px rgba(239,68,68,.18)", "important");
      subject.style.setProperty("color", "#ef4444", "important");
      say("Please select subject first", true);
      window.StudyRoomSubjectPicker?.sync?.();
      if (window.StudyRoomSubjectPicker) window.StudyRoomSubjectPicker.focus();
      else subject.focus();
      return;
    }

    const hasExistingSession = Boolean(member?.session_active);
    const target = hasExistingSession
      ? Number(member.session_target_seconds) || selectedTargetSeconds()
      : selectedTargetSeconds();
    if (!target || target < 60 || (!hasExistingSession && target > 39540)) {
      showTargetError();
      return;
    }

    subject.removeAttribute("aria-invalid");
    subject.classList.remove("room-subject-required");
    subject.style.removeProperty("border-color");
    subject.style.removeProperty("box-shadow");
    subject.style.removeProperty("color");
    clearTargetError();

    sessionAction = hasExistingSession ? 'continue' : 'start';
    updateSessionUI(member);
    try {
      await callRpc("study_room_set_subject", { p_subject: subject.value });
      // The server preserves an existing session's original target on resume.
      // Pass a valid new-target value so legacy 12-hour sessions remain resumable.
      await callRpc("study_room_start", { p_target_seconds: hasExistingSession ? Math.min(target, 39540) : target });
      await loadRows();
      await heartbeat();
      say("Your study session has started. If you leave the Study Room, it continues until your target and then pauses.");
    } catch (e) {
      say("Could not start the study session: " + e.message, true);
    } finally {
      sessionAction = null;
      updateSessionUI(member);
    }
  }
  async function pauseStudy() {
    if (sessionAction || !member?.is_studying) return;
    sessionAction = 'pause';
    updateSessionUI(member);
    pause.textContent = 'Pausing…';
    try {
      // Let an already-running heartbeat finish before the explicit pause RPC.
      // The database pause function then settles the final interval atomically.
      if (heartbeatPromise) await heartbeatPromise;
      await callRpc('study_room_pause');
      await loadRows();
      refreshPersonalHistory(); // server credits are committed by the pause RPC
      say('Your study session is paused. Press Continue to resume it.');
    } catch (e) {
      say('Could not pause the study session: ' + e.message, true);
      try { await loadRows(); } catch (_) {}
    } finally {
      sessionAction = null;
      updateSessionUI(member);
    }
  }
  async function endStudy() {
    if (sessionAction) return;
    try {
      await callRpc('study_room_end');
      await loadRows();
      refreshPersonalHistory(); // immediate personal-history refresh, not the 60s fallback
      targetHours.value = '';
      targetMinutes.value = '';
      updatePersonal();
      say('Your study session has ended. Your recorded study time is saved.');
    } catch (e) { say('Could not end the study session: ' + e.message, true); }
  }
  function timerSnapshot() {
    const today = dayKey(new Date());
    const base = member && (member.session_active || member.is_studying)
      ? Math.max(0, Number(member.session_elapsed_seconds) || 0) : 0;
    const live = pendingSeconds(member, 0);
    return {
      ready: Boolean(member),
      isStudying: Boolean(member?.is_studying),
      sessionActive: Boolean(member?.session_active),
      elapsedSeconds: base + live,
      todaySeconds: member && member.today_date === today ? Math.max(0, Number(member.today_seconds) || 0) : 0,
      pendingTodaySeconds: pendingSeconds(member, startOfDay(today)),
      todayDate: today,
      weekSeconds: member?.week_start === weekStart(new Date()) ? Math.max(0, Number(member?.week_seconds) || 0) : 0,
      pendingWeekSeconds: pendingSeconds(member, startOfDay(weekStart(new Date()))),
      subject: member?.session_active ? (member.subject || subject.value || '') : (subject.value || ''),
      status: member?.session_presence_state === 'away' ? 'Away' : member?.is_studying ? 'Studying' : member?.session_active ? 'Paused' : 'Not studying',
      sessionPresenceState: member?.session_presence_state || 'paused',
      targetSeconds: Number(member?.session_target_seconds) || 0,
      lastHeartbeatAt: member?.last_heartbeat_at || null,
      sessionStartedAt: member?.session_started_at || null,
      targetReachedAt: member?.session_target_reached_at || null,
      updatedAt: member?.updated_at || null,
      sessionExpiredAt: member?.session_expired_at || null
    };
  }
  function emitTimerState() {
    window.dispatchEvent(new CustomEvent('studylab:study-room-timer', {detail: timerSnapshot()}));
  }
  window.StudyRoomTimer = {getState:timerSnapshot,start:startStudy,pause:pauseStudy,end:endStudy};
  async function init() {
    if (!cfg || !window.supabase || !window.StudyLabAccount) {
      say('Real-time sync is not configured yet. Add your Supabase Project URL and anon/public key in assets/js/study-room-config.js, then run the SQL in supabase/study-room.sql.', true);
      join.disabled = true; pause.disabled = true; leave.disabled = true;
      liveLabel.textContent = 'Setup required';
      activeCount.textContent = '—'; weeklyHours.textContent = '—';
      people.innerHTML = '<p class="room-empty">Live attendance appears after the database is connected.</p>';
      board.innerHTML = '<p class="room-empty">Real rankings will appear after setup. No sample scores are shown.</p>';
      return;
    }
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error('StudyLab account is unavailable. Reload the page and try again.');
      await account.ready;
      client = account.client;
      const user = account.getUser?.();
      if (!client || !user?.id) throw new Error('StudyLab student identity is unavailable.');
      userId = user.id;
      const {data: sessionData, error: sessionError} = await client.auth.getSession();
      if (sessionError) throw sessionError;
      accessToken = sessionData?.session?.access_token || null;
      client.auth.onAuthStateChange((_event, session) => {
        accessToken = session?.access_token || null;
      });
      const profile = await account.getProfile(true);
      if (!isProfileComplete(profile)) {
        join.disabled = true; pause.disabled = true; leave.disabled = true;
        say('Complete your profile to enter the Study Room.', true);
        const resumeAfterProfileSave = event => {
          if (!isProfileComplete(event.detail)) return;
          window.removeEventListener('studylab-profile-updated', resumeAfterProfileSave);
          init();
        };
        window.addEventListener('studylab-profile-updated', resumeAfterProfileSave);
        return;
      }
      await callRpc('study_room_ensure_profile');
      await loadRows();
      startRoomPresenceLifecycle();
      client.channel('study-room-live')
        .on('postgres_changes', {event:'*',schema:'public',table:'study_room_members'}, () => {
          scheduleGlobalRefresh();
        })
        .on('postgres_changes', {event:'UPDATE',schema:'public',table:'study_room_members',filter:'user_id=eq.' + userId}, () => {
          refreshOwnRow().catch(e => console.error('Could not refresh own Study Room state', e));
        }).subscribe();
      join.addEventListener('click', startStudy);
      pause.addEventListener('click', () => {
        if (sessionAction || !member?.session_active) return;
        if (member.is_studying) pauseStudy();
        else if (member.session_presence_state !== 'away') startStudy();
      });
      leave.addEventListener('click', endStudy);
      subject.addEventListener('change', async () => {
        subject.removeAttribute('aria-invalid');
        subject.classList.remove('room-subject-required');
        subject.style.removeProperty('border-color');
        subject.style.removeProperty('box-shadow');
        subject.style.removeProperty('color');
        if (!subject.value || !member?.session_active) return;
        try {
          await callRpc('study_room_set_subject', {p_subject: subject.value});
          await refreshOwnRow();
          refreshPersonalHistory(); // the previous subject's credited interval was settled
        } catch(e) { say('Could not update subject: ' + e.message, true); }
      });
      dailyTab.addEventListener('click', () => { selectedBoard = 'daily'; renderBoard(); });
      weeklyTab.addEventListener('click', () => { selectedBoard = 'weekly'; renderBoard(); });
      [targetHours, targetMinutes].forEach(input => input.addEventListener('input', () => {
        clearTargetError();
        updatePersonal();
      }));
      if (!window.StudyRoomPresence) heartbeatInterval = setInterval(heartbeat, 20000);
      // Re-fetch the shared rows once per minute even if Realtime drops an event.
      // This keeps both daily and weekly rankings fresh for paused and active members.
      rankRefreshInterval = setInterval(() => {
        // The normal heartbeat refreshes active members; this fallback covers
        // paused members and cases where a Realtime event was missed.
        if (!heartbeatPromise) {
          loadRows().catch(error => console.error('Could not refresh Study Room rankings', error));
        }
      }, 60000);
      // Refresh visible ranks from already-cached session scores; no new DB calls.
      let lastRankUiRefresh = 0;
      uiInterval = setInterval(() => {
        updatePersonal();
        if (!document.hidden && Date.now() - lastRankUiRefresh >= 10000) {
          lastRankUiRefresh = Date.now();
          renderPeople();
          renderBoard();
        }
      }, 1000);
      window.addEventListener('online', () => {
        presenceController?.refresh();
        heartbeat();
        loadRows().catch(error => console.error("Could not refresh Study Room after reconnecting", error));
      });
      await heartbeat();
      say('Connected to the shared Study Room. Attendance and leaderboard updates are live.');
    } catch (e) {
      console.error(e);
      say('Supabase connection failed: ' + e.message + '. Check the project URL/key, anonymous sign-in, and SQL setup.', true);
      liveLabel.textContent = 'Connection error';
      join.disabled = true; pause.disabled = true; leave.disabled = true;
      activeCount.textContent = '—'; weeklyHours.textContent = '—';
      people.innerHTML = '<p class="room-empty">Live data is unavailable until the connection is fixed.</p>';
      board.innerHTML = '<p class="room-empty">Leaderboard unavailable.</p>';
    }
  }
  updateSessionUI(null);
  join.disabled = true;
  pause.disabled = true;
  leave.disabled = true;
  init();
})();