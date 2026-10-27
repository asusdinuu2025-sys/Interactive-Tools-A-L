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
  const leave = $('leaveStudy');
  const todayTotal = $('todayTotal');
  const goalBar = $('goalProgressBar');
  const goalText = $('goalProgressText');
  const people = $('peopleGrid');
  const board = $('leaderboardList');
  // Give scrollable panels a small elastic response when a wheel gesture hits an edge.
  function addRubberBandFeedback(element) {
    if (!element) return;
    element.addEventListener('wheel', event => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !event.deltaY) return;
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop >= maxScroll - 1;
      const pullingPastEdge = (atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0);
      if (!pullingPastEdge) return;
      event.preventDefault();
      const edgeClass = event.deltaY < 0 ? 'rubberband-top' : 'rubberband-bottom';
      element.classList.remove('rubberband-top', 'rubberband-bottom');
      void element.offsetWidth;
      element.classList.add(edgeClass);
    }, {passive: false});
    element.addEventListener('animationend', event => {
      if (event.target === element) element.classList.remove('rubberband-top', 'rubberband-bottom');
    });
  }
  addRubberBandFeedback(people);
  addRubberBandFeedback(board);
  const dailyTab = $('dailyBoardTab');
  const weeklyTab = $('weeklyBoardTab');
  let client, userId = null, member = null, rows = [], interval = null;
  let lastTick = Date.now(), selectedBoard = 'daily';
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
    element.innerHTML = kind === "female"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"></circle><path d="M7 20l1-4.2a4.1 4.1 0 0 1 8 0l1 4.2z"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.2"></circle><path d="M4.5 20v-2.5a7.5 7.5 0 0 1 15 0V20z"></path></svg>';
  }
  function say(text, isError = false) {
    notice.textContent = text;
    notice.style.borderColor = isError ? 'rgba(255,105,105,.35)' : '';
  }
  function updatePersonal() {
    const localToday = dayKey(new Date());
    const seconds = member && member.today_date === localToday ? member.today_seconds : 0;
    const pending = member && member.is_studying && member.last_heartbeat_at
      ? Math.max(0, Math.min(25, Math.floor((Date.now() - new Date(member.last_heartbeat_at).getTime()) / 1000))) : 0;
    const total = seconds + pending;
    todayTotal.textContent = 'Today: ' + fmt(total);
    const percent = Math.min(100, Math.round(total / (Number(goal.value) || 14400) * 100));
    goalBar.style.width = percent + '%';
    goalText.textContent = percent >= 100 ? 'Goal reached!' : percent + '% completed';
    const sessionSeconds = member && member.is_studying && member.session_started_at
      ? Math.max(0, Math.floor((Date.now() - new Date(member.session_started_at).getTime()) / 1000)) : 0;
    timer.textContent = fmt(sessionSeconds);
  }
  function updateSessionUI(isJoined) {
    join.disabled = isJoined;
    leave.disabled = !isJoined;
    status.textContent = isJoined ? 'Studying' : 'Not studying';
    panel.classList.toggle('is-studying', isJoined);
    label.textContent = isJoined
      ? 'Studying ' + subject.value + ' · session in progress'
      : 'Not studying · timer paused';
    liveLabel.textContent = 'Live shared room';
  }
  function renderPeople() {
    const now = Date.now();
    const active = rows.filter(r => r.is_studying && r.last_heartbeat_at &&
      now - new Date(r.last_heartbeat_at).getTime() < 90000);
    activeCount.textContent = String(active.length);
    const own = rows.find(r => r.user_id === userId) || member;
    const currentWeek = weekStart(new Date());
    const weeklyRanked = rows
      .map(r => ({...r, rankScore: r.week_start === currentWeek ? Number(r.week_seconds) || 0 : 0}))
      .sort((a,b) => b.rankScore - a.rankScore);
    const ownRankIndex = weeklyRanked.findIndex(r => r.user_id === userId);
    yourRank.textContent = ownRankIndex >= 0 ? '#' + (ownRankIndex + 1) : '—';
    yourRank.title = ownRankIndex >= 0
      ? 'Ranked by total study time this week among Study Room members'
      : 'Your rank appears after your Study Room record is available';
    const thisWeek = own && own.week_start === weekStart(new Date())
      ? Number(own.week_seconds) || 0 : 0;
    const pendingWeek = own && own.is_studying && own.last_heartbeat_at
      ? Math.max(0, Math.min(25, Math.floor((Date.now() - new Date(own.last_heartbeat_at).getTime()) / 1000))) : 0;
    weeklyHours.textContent = compact(thisWeek + pendingWeek);
    people.replaceChildren();
    if (!active.length) {
      people.innerHTML = '<p class="room-empty">No one is studying right now. Be the first to join.</p>';
    } else {
      active.sort((a,b) => a.display_name.localeCompare(b.display_name)).forEach(r => {
        const card = document.createElement('article');
        card.className = 'room-person-card';
        const today = r.today_date === dayKey(new Date()) ? r.today_seconds : 0;
        card.innerHTML = '<div class="room-person-card-top"><div class="room-avatar"></div><span class="room-person-status">Studying now</span></div>' +
          '<div class="room-person-card-name"></div><div class="room-person-card-subject"></div>' +
          '<div class="room-person-card-divider"></div><div class="room-person-card-time-label">Today\'s study time</div><div class="room-person-card-time"></div>';
        setGenderIcon(card.querySelector('.room-avatar'), r.gender);
        card.querySelector('.room-person-card-name').textContent = r.display_name;
        card.querySelector('.room-person-card-subject').textContent = r.subject;
        card.querySelector('.room-person-card-time').textContent = fmt(today);
        people.appendChild(card);
      });
    }
  }
  function renderBoard() {
    const field = selectedBoard === 'daily' ? 'today_seconds' : 'week_seconds';
    const bucket = selectedBoard === 'daily' ? 'today_date' : 'week_start';
    const expected = selectedBoard === 'daily' ? dayKey(new Date()) : weekStart(new Date());
    const ranked = rows.map(r => ({...r, score: r[bucket] === expected ? Number(r[field]) || 0 : 0}))
      .sort((a,b) => b.score - a.score);
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
      'user_id,display_name,gender,subject,is_studying,session_started_at,last_heartbeat_at,today_seconds,today_date,week_seconds,week_start'
    );
    if (error) throw error;
    rows = data || [];
    const current = rows.find(r => r.user_id === userId);
    if (current) member = current;
    renderPeople();
    renderBoard();
    updatePersonal();
  }
  async function callRpc(name, args) {
    const {error} = await client.rpc(name, args || {});
    if (error) throw error;
  }
  async function heartbeat() {
    if (!client || !userId) return;
    try {
      await callRpc('study_room_heartbeat');
      await loadRows();
    } catch (e) {
      console.error('Study Room heartbeat failed', e);
    }
  }
  async function startStudy() {
    try {
      await callRpc('study_room_set_subject', {p_subject: subject.value});
      await callRpc('study_room_start');
      lastTick = Date.now();
      updateSessionUI(true);
      if (interval) clearInterval(interval);
      interval = setInterval(async () => {
        const now = Date.now();
        lastTick = now;
        updatePersonal();
      }, 1000);
      await heartbeat();
      say('You are in the shared room. Updates are live across connected devices.');
    } catch (e) { say('Could not join the room: ' + e.message, true); }
  }
  async function leaveStudy() {
    try {
      await callRpc('study_room_leave');
      if (interval) clearInterval(interval);
      interval = null;
      updateSessionUI(false);
      await loadRows();
      say('You left the study room. Your recorded study time is saved.');
    } catch (e) { say('Could not leave the room: ' + e.message, true); }
  }
  async function init() {
    if (!cfg || !window.supabase || !window.StudyLabAccount) {
      say('Real-time sync is not configured yet. Add your Supabase Project URL and anon/public key in assets/js/study-room-config.js, then run the SQL in supabase/study-room.sql.', true);
      join.disabled = true; leave.disabled = true;
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
        join.disabled = true;
        leave.disabled = true;
        say('Complete your profile to enter the Study Room.', true);
        // The profile window is displayed over this page. Once its save event
        // confirms a complete profile, initialise the live room in place.
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
      const own = rows.find(r => r.user_id === userId);
      if (own && own.is_studying && own.last_heartbeat_at &&
          Date.now() - new Date(own.last_heartbeat_at).getTime() < 90000) {
        member = own; updateSessionUI(true);
        lastTick = Date.now();
        interval = setInterval(updatePersonal, 1000);
      } else updateSessionUI(false);
      client.channel('study-room-live')
        .on('postgres_changes', {event:'*',schema:'public',table:'study_room_members'}, () => {
          loadRows().catch(e => console.error('Could not refresh live Study Room data', e));
        }).subscribe();
      join.addEventListener('click', startStudy);
      leave.addEventListener('click', leaveStudy);
      subject.addEventListener('change', async () => {
        try { await callRpc('study_room_set_subject', {p_subject: subject.value}); }
        catch(e) { say('Could not update subject: ' + e.message, true); }
      });
      dailyTab.addEventListener('click', () => { selectedBoard = 'daily'; renderBoard(); });
      weeklyTab.addEventListener('click', () => { selectedBoard = 'weekly'; renderBoard(); });
      goal.addEventListener('change', updatePersonal);
      setInterval(heartbeat, 20000);
      await heartbeat();
      say('Connected to the shared Study Room. Attendance and leaderboard updates are live.');
    } catch (e) {
      console.error(e);
      say('Supabase connection failed: ' + e.message + '. Check the project URL/key, anonymous sign-in, and SQL setup.', true);
      liveLabel.textContent = 'Connection error';
      join.disabled = true; leave.disabled = true;
      activeCount.textContent = '—'; weeklyHours.textContent = '—';
      people.innerHTML = '<p class="room-empty">Live data is unavailable until the connection is fixed.</p>';
      board.innerHTML = '<p class="room-empty">Leaderboard unavailable.</p>';
    }
  }
  updateSessionUI(false);
  join.disabled = true;
  leave.disabled = true;
  init();
})();