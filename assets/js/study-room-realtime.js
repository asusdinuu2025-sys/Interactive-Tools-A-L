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
  const goal = $('dailyGoal');
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
  let client, userId = null, member = null, rows = [], heartbeatInterval = null, uiInterval = null;
  let heartbeatRetryTimer = null, heartbeatPromise = null;
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
  // The database view is authoritative and masks attendance after 90 seconds.
  function heartbeatIsFresh(row) {
    return Boolean(row?.is_studying && row.last_heartbeat_at);
  }
  function pendingSeconds(row, boundary) {
    if (!heartbeatIsFresh(row)) return 0;
    const heartbeatAt = new Date(row.last_heartbeat_at).getTime();
    return Math.min(90, Math.max(0, Math.floor((Date.now() - Math.max(heartbeatAt, boundary)) / 1000)));
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
  function updatePersonal() {
    const today = dayKey(new Date());
    const todaySeconds = member && member.today_date === today ? Number(member.today_seconds) || 0 : 0;
    const pendingToday = pendingSeconds(member, startOfDay(today));
    const total = todaySeconds + pendingToday;
    todayTotal.textContent = 'Today: ' + fmt(total);
    const percent = Math.min(100, Math.round(total / (Number(goal.value) || 14400) * 100));
    goalBar.style.width = percent + '%';
    goalText.textContent = percent >= 100 ? 'Goal reached!' : percent + '% completed';
    const savedSessionSeconds = member && (member.session_active || member.is_studying)
      ? Math.max(0, Number(member.session_elapsed_seconds) || 0) : 0;
    const liveSessionSeconds = pendingSeconds(member, 0);
    timer.textContent = fmt(savedSessionSeconds + liveSessionSeconds);
    emitTimerState();
  }
  function updateSessionUI(row) {
    const isRunning = Boolean(row?.is_studying);
    const hasSession = Boolean(row?.session_active);
    join.disabled = isRunning;
    pause.disabled = !isRunning;
    leave.disabled = !hasSession;
    join.textContent = 'Start';
    pause.textContent = 'Pause';
    leave.textContent = 'End';
    status.textContent = isRunning ? 'Studying' : hasSession ? 'Paused' : 'Not studying';
    panel.classList.toggle('is-studying', isRunning);
    label.textContent = isRunning
      ? 'Studying ' + (row?.subject || subject.value) + ' · session in progress'
      : hasSession ? 'Paused · press Start to resume' : 'Not studying · press Start to begin';
    liveLabel.textContent = 'Live shared room';
    emitTimerState();
  }
  function renderPeople() {
    const active = rows.filter(heartbeatIsFresh);
    activeCount.textContent = String(active.length);
    const own = rows.find(r => r.user_id === userId) || member;
    const currentWeek = weekStart(new Date());
    const weeklyRanked = rows.map(r => ({
      ...r, rankScore: (r.week_start === currentWeek ? Number(r.week_seconds) || 0 : 0) + pendingSeconds(r, startOfDay(currentWeek))
    })).sort((a,b) => b.rankScore - a.rankScore);
    const ownRankIndex = weeklyRanked.findIndex(r => r.user_id === userId);
    yourRank.textContent = ownRankIndex >= 0 ? '#' + (ownRankIndex + 1) : '—';
    yourRank.title = ownRankIndex >= 0
      ? 'Ranked by total study time this week among Study Room members'
      : 'Your rank appears after your Study Room record is available';
    const thisWeek = own && own.week_start === currentWeek ? Number(own.week_seconds) || 0 : 0;
    weeklyHours.textContent = compact(thisWeek + pendingSeconds(own, startOfDay(currentWeek)));
    people.replaceChildren();
    if (!active.length) {
      people.innerHTML = '<p class="room-empty">No one is studying right now. Be the first to start.</p>';
    } else {
      active.sort((a,b) => a.display_name.localeCompare(b.display_name)).forEach(r => {
        const card = document.createElement('article');
        card.className = 'room-person-card';
        const today = r.today_date === dayKey(new Date()) ? Number(r.today_seconds) || 0 : 0;
        const liveToday = pendingSeconds(r, startOfDay(dayKey(new Date())));
        card.innerHTML = '<div class="room-person-card-top"><div class="room-avatar"></div><span class="room-person-status">Studying now</span></div>' +
          '<div class="room-person-card-name"></div><div class="room-person-card-subject"></div>' +
          '<div class="room-person-card-divider"></div><div class="room-person-card-time-label">Today\'s study time</div><div class="room-person-card-time"></div>';
        const avatar = card.querySelector('.room-avatar');
        setGenderIcon(avatar, r.gender);
        const neonPalette = [['#45ddff','#087da0'],['#b79aff','#7040c7'],['#55edb0','#08794e'],['#ffd166','#9a5b00'],['#ff83c8','#b21b70'],['#ff8b6b','#b83b22']];
        const identity = String(r.user_id || r.display_name || 'student');
        let colourHash = 0;
        for (let index = 0; index < identity.length; index++) colourHash = (colourHash * 31 + identity.charCodeAt(index)) | 0;
        const neon = neonPalette[Math.abs(colourHash) % neonPalette.length];
        avatar.classList.add('slr-neon-avatar');
        avatar.style.setProperty('--slr-neon-dark', neon[0]);
        avatar.style.setProperty('--slr-neon-light', neon[1]);
        avatar.title = 'Studying now';
        card.querySelector('.room-person-card-name').textContent = r.display_name;
        card.querySelector('.room-person-card-subject').textContent = r.subject;
        card.querySelector('.room-person-card-time').textContent = profileDuration(today + liveToday);
        people.appendChild(card);
      });
    }
  }
  function renderBoard() {
    const field = selectedBoard === 'daily' ? 'today_seconds' : 'week_seconds';
    const bucket = selectedBoard === 'daily' ? 'today_date' : 'week_start';
    const expected = selectedBoard === 'daily' ? dayKey(new Date()) : weekStart(new Date());
    const boundary = startOfDay(expected);
    const ranked = rows.map(r => ({
      ...r,
      score: (r[bucket] === expected ? Number(r[field]) || 0 : 0) +
        (r.is_studying ? pendingSeconds(r, boundary) : 0)
    })).sort((a,b) => b.score - a.score);
    board.replaceChildren();
    if (!ranked.length) {
      board.innerHTML = '<p class="room-empty">The leaderboard will appear as students study.</p>';
    } else {
      ranked.forEach((r,i) => {
        const item = document.createElement('div');
        item.className = 'room-rank';
        item.innerHTML = '<span class="room-rank-number"></span><div class="room-avatar"></div>' +
          '<div class="room-rank-info"><strong></strong><span></span></div><span class="room-time"></span>';
        item.querySelector('.room-rank-number').textContent = String(i+1);
        setGenderIcon(item.querySelector('.room-avatar'), r.gender);
        item.querySelector('.room-rank-info strong').textContent = r.display_name;
        item.querySelector('.room-rank-info span').textContent = r.subject;
        item.querySelector('.room-time').textContent = compact(r.score);
        board.appendChild(item);
      });
    }
    dailyTab.classList.toggle('active', selectedBoard === 'daily');
    weeklyTab.classList.toggle('active', selectedBoard === 'weekly');
    dailyTab.setAttribute('aria-pressed', String(selectedBoard === 'daily'));
    weeklyTab.setAttribute('aria-pressed', String(selectedBoard === 'weekly'));
  }
  async function loadRows() {
    const {data,error} = await client.from('study_room_live').select(
      'user_id,display_name,gender,subject,is_studying,session_active,session_started_at,session_elapsed_seconds,session_date,last_heartbeat_at,today_seconds,today_date,week_seconds,week_start,updated_at'
    );
    if (error) throw error;
    rows = data || [];
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
      return Date.now() - Number(localStorage.getItem(key) || 0) < 45000;
    } catch (_) { return false; }
  }
  async function heartbeat(isRetry = false) {
    if (!client || !userId || !member?.is_studying) return;
    if (!isRetry && heartbeatWasRecentlySuccessful()) return;
    if (heartbeatPromise) return heartbeatPromise;
    heartbeatPromise = (async () => {
      try {
        await callRpc('study_room_heartbeat');
        try { localStorage.setItem("studylab:study-room-heartbeat:" + userId, String(Date.now())); } catch (_) {}
        if (heartbeatRetryTimer) {
          clearTimeout(heartbeatRetryTimer);
          heartbeatRetryTimer = null;
        }
        await loadRows();
      } catch (e) {
        console.error('Study Room heartbeat failed', e);
        // One short retry for a transient network failure; the next normal
        // heartbeat remains on the regular 60-second schedule.
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
    if (!subject.value) {
      subject.setAttribute('aria-invalid', 'true');
      subject.classList.add('room-subject-required');
      subject.style.setProperty('border-color', '#ef4444', 'important');
      subject.style.setProperty('box-shadow', '0 0 0 3px rgba(239,68,68,.18)', 'important');
      subject.style.setProperty('color', '#ef4444', 'important');
      say('Please select subject first', true);
      subject.focus();
      return;
    }
    subject.removeAttribute('aria-invalid');
    subject.classList.remove('room-subject-required');
    subject.style.removeProperty('border-color');
    subject.style.removeProperty('box-shadow');
        subject.style.removeProperty('color');
    try {
      await callRpc('study_room_set_subject', {p_subject: subject.value});
      await callRpc('study_room_start');
      await loadRows();
      await heartbeat();
      say('Your study session has started. The timer continues while you switch tabs or minimize the browser.');
    } catch (e) { say('Could not start the study session: ' + e.message, true); }
  }
  async function pauseStudy() {
    try {
      await callRpc('study_room_pause');
      await loadRows();
      say('Your study session is paused. Press Start to resume it.');
    } catch (e) { say('Could not pause the study session: ' + e.message, true); }
  }
  async function endStudy() {
    try {
      await callRpc('study_room_end');
      await loadRows();
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
      subject: member?.subject || subject.value || '',
      status: member?.is_studying ? 'Studying' : member?.session_active ? 'Paused' : 'Not studying',
      lastHeartbeatAt: member?.last_heartbeat_at || null,
      sessionStartedAt: member?.session_started_at || null,
      updatedAt: member?.updated_at || null
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
      client.channel('study-room-live')
        .on('postgres_changes', {event:'*',schema:'public',table:'study_room_members'}, () => {
          loadRows().catch(e => console.error('Could not refresh live Study Room data', e));
        }).subscribe();
      join.addEventListener('click', startStudy);
      pause.addEventListener('click', pauseStudy);
      leave.addEventListener('click', endStudy);
      subject.addEventListener('change', async () => {
        subject.removeAttribute('aria-invalid');
        subject.classList.remove('room-subject-required');
        subject.style.removeProperty('border-color');
        subject.style.removeProperty('box-shadow');
        subject.style.removeProperty('color');
        try { await callRpc('study_room_set_subject', {p_subject: subject.value}); await loadRows(); }
        catch(e) { say('Could not update subject: ' + e.message, true); }
      });
      dailyTab.addEventListener('click', () => { selectedBoard = 'daily'; renderBoard(); });
      weeklyTab.addEventListener('click', () => { selectedBoard = 'weekly'; renderBoard(); });
      goal.addEventListener('change', updatePersonal);
      heartbeatInterval = setInterval(heartbeat, 60000);
      uiInterval = setInterval(updatePersonal, 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') heartbeat(); });
      window.addEventListener('online', heartbeat);
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