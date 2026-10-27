/* Additive Study Room UI enhancements. Does not change existing database or session RPCs. */
(() => {
'use strict';
function init(){

  // Room appearance is local to this page and does not change the site's global theme.
  const initRoomAppearance=()=>{
   const root=document.body,wrap=document.getElementById('roomAppearance'),trigger=document.getElementById('roomAppearanceTrigger'),menu=document.getElementById('roomAppearanceMenu'),current=document.getElementById('roomAppearanceCurrent');
   if(!root||!wrap||!trigger||!menu||wrap.dataset.initialized==='true')return;
   wrap.dataset.initialized='true';
   const allowed=new Set(['charcoal','mint','midnight-blue','pinky','forest-green','lavender','warm-sand','ocean']);
   const legacy={dark:'charcoal',light:'mint'};
   const labels={charcoal:'Charcoal',mint:'Mint','midnight-blue':'Midnight Blue','pinky':'Pinky','forest-green':'Forest Green','lavender':'Lavender','warm-sand':'Warm Sand',ocean:'Ocean'};
   const themeKey='studylab-room-appearance-v1',modeKey='studylab-room-mode-v1';
   let savedTheme='midnight-blue',savedMode='system';
   try{const value=localStorage.getItem(themeKey);if(allowed.has(value))savedTheme=value;else if(legacy[value])savedTheme=legacy[value];const mode=localStorage.getItem(modeKey);if(['light','dark','system'].includes(mode))savedMode=mode;}catch(_){}
   const modeButtons=[...document.querySelectorAll('[data-room-mode-choice]')];
    const glowStyle=document.createElement("style");
    glowStyle.textContent='.room-avatar.slr-neon-avatar{position:relative!important;isolation:isolate;overflow:visible!important;border-radius:50%!important;aspect-ratio:1/1} .room-avatar.slr-neon-avatar>svg{display:block;width:72%;height:72%;overflow:visible;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round} .room-avatar.slr-neon-avatar:after{content:"";position:absolute;z-index:2;inset:-5px;border:2px solid var(--slr-neon-dark,#45ddff);border-radius:50%;background:transparent;box-sizing:border-box;filter:drop-shadow(0 0 3px var(--slr-neon-dark,#45ddff)) drop-shadow(0 0 7px color-mix(in srgb,var(--slr-neon-dark,#45ddff) 55%,transparent));pointer-events:none} html[data-theme="light"] .room-avatar.slr-neon-avatar:after,body[data-room-mode="light"] .room-avatar.slr-neon-avatar:after{border-color:var(--slr-neon-light,#087da0);filter:drop-shadow(0 0 3px var(--slr-neon-light,#087da0)) drop-shadow(0 0 6px color-mix(in srgb,var(--slr-neon-light,#087da0) 45%,transparent))}';
    document.head.appendChild(glowStyle);
   let systemQuery=null;
   try{systemQuery=window.matchMedia('(prefers-color-scheme: dark)');}catch(_){}
   const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
   const applyMode=(mode,save=true)=>{
    const choice=['light','dark','system'].includes(mode)?mode:'system';
    const effective=choice==='system'?(systemQuery&&systemQuery.matches?'dark':'light'):choice;
    root.dataset.roomMode=effective;
    root.dataset.roomModeChoice=choice;
    modeButtons.forEach(button=>{const selected=button.dataset.roomModeChoice===choice;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('is-selected',selected);});
    if(save){try{localStorage.setItem(modeKey,choice);}catch(_){}}
   };
   const applyTheme=(value,announce=false)=>{
    const theme=allowed.has(value)?value:'midnight-blue';
    const previous=root.dataset.roomTheme||'midnight-blue';
    root.dataset.roomTheme=theme;
    if(current)current.textContent=labels[theme];
    menu.querySelectorAll('[data-room-theme-choice]').forEach(option=>{
     const selected=option.dataset.roomThemeChoice===theme;
     option.setAttribute('aria-checked',String(selected));
     option.classList.toggle('is-selected',selected);
    });
    try{localStorage.setItem(themeKey,theme);}catch(_){}
    if(announce&&previous!==theme)document.dispatchEvent(new CustomEvent('studylab:room-theme-change',{detail:{theme,previous}}));
   };
   modeButtons.forEach(button=>button.addEventListener('click',()=>applyMode(button.dataset.roomModeChoice)));
   if(systemQuery&&typeof systemQuery.addEventListener==='function')systemQuery.addEventListener('change',()=>{if(root.dataset.roomModeChoice==='system')applyMode('system',false);});
   trigger.addEventListener('click',()=>{const opening=menu.hidden;menu.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));});
   menu.querySelectorAll('[data-room-theme-choice]').forEach(option=>option.addEventListener('click',()=>{applyTheme(option.dataset.roomThemeChoice,true);close();trigger.focus();}));
   document.addEventListener('click',event=>{if(!wrap.contains(event.target))close();});
   document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){close();trigger.focus();}});
   wrap.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&event.target===trigger){event.preventDefault();menu.querySelector('[data-room-theme-choice]')?.focus();}});
   applyMode(savedMode,false);
   applyTheme(savedTheme);
  };
  initRoomAppearance();

 const hero=document.querySelector('.room-hero'),layout=document.querySelector('.room-layout'),actions=document.querySelector('.room-session-actions'),board=document.getElementById('leaderboardList');
 if(!hero||!layout||!actions||document.getElementById('slrEnhancementsReady'))return;
 const marker=document.createElement('span');marker.id='slrEnhancementsReady';marker.hidden=true;document.querySelector('.room-page')?.append(marker);
 const focus=document.createElement('section');focus.className='slr-focus-card';focus.setAttribute('aria-label','Optional focus timer');
 focus.innerHTML='<div class="slr-focus-head"><div><strong>Optional focus timer</strong><small>Separate from your official Study Room time</small></div><span class="slr-focus-mode" id="slrFocusMode">FOCUS</span></div><div class="slr-focus-clock" id="slrFocusClock" role="timer" aria-live="off">25:00</div><div class="slr-focus-track" aria-hidden="true"><span id="slrFocusProgress"></span></div><div class="slr-focus-actions"><button type="button" class="slr-focus-primary" id="slrFocusStart">▶ Start</button><button type="button" id="slrFocusReset">↺ Reset</button><button type="button" id="slrFocusBreak">☕ 5-min break</button></div><small class="slr-focus-note">A gentle focus guide. The existing Join Study / Leave Study buttons still control official room time.</small>';
 actions.insertAdjacentElement('afterend',focus);
 let mode='focus',duration=1500,remaining=duration,timer=null;
 const clock=document.getElementById('slrFocusClock'),modeLabel=document.getElementById('slrFocusMode'),progress=document.getElementById('slrFocusProgress'),start=document.getElementById('slrFocusStart');
 const fmt=s=>String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')+':'+String(Math.max(0,s)%60).padStart(2,'0');
 const paint=()=>{clock.textContent=fmt(remaining);progress.style.width=Math.max(0,remaining/duration*100)+'%';};
 const stop=()=>{if(timer)clearInterval(timer);timer=null;};
 const setMode=m=>{stop();mode=m;duration=(m==='focus'?25:5)*60;remaining=duration;modeLabel.textContent=m==='focus'?'FOCUS':'BREAK';start.textContent='▶ Start '+m;paint();};
 start.addEventListener('click',()=>{if(timer){stop();start.textContent='▶ Resume';return;}start.textContent='Ⅱ Pause';timer=setInterval(()=>{remaining--;paint();if(remaining<=0){stop();modeLabel.textContent=mode==='focus'?'FOCUS COMPLETE':'BREAK COMPLETE';start.textContent='▶ Start next';mode=mode==='focus'?'break':'focus';duration=(mode==='focus'?25:5)*60;remaining=duration;paint();}},1000);});
 document.getElementById('slrFocusReset').addEventListener('click',()=>setMode(mode));
 document.getElementById('slrFocusBreak').addEventListener('click',()=>setMode('break'));
 const achievements=document.createElement('section');achievements.className='room-panel slr-achievements';achievements.id='slrAchievements';
 achievements.innerHTML='<div class="room-panel-head"><div><h2>Study streaks & achievements</h2><div class="tiny">Consistency over endless screen time.</div></div><span aria-hidden="true" style="font-size:1.5rem">🏆</span></div><div class="slr-achievement-summary"><div class="slr-streak-orb" aria-hidden="true">🔥</div><div class="slr-streak-copy"><strong id="slrStreakValue">0-day streak</strong><span id="slrStreakCaption">Complete a 10-minute room session to start a streak.</span></div></div><div class="slr-progress-label"><strong>Weekly focus milestone</strong><span id="slrWeeklyProgressText">0h 0m / 7 hours</span></div><div class="slr-achievement-track" role="progressbar" aria-label="Weekly focus milestone" aria-valuemin="0" aria-valuemax="7" aria-valuenow="0" id="slrWeeklyProgress"><span id="slrWeeklyProgressBar"></span></div><div class="slr-badges"><div class="slr-badge" data-kind="hours" data-threshold="3600"><span class="slr-badge-icon">🌱</span><strong>First hour</strong><small>1 hour studied this week</small></div><div class="slr-badge" data-kind="hours" data-threshold="7200"><span class="slr-badge-icon">📘</span><strong>Bookworm</strong><small>2 hours studied this week</small></div><div class="slr-badge" data-kind="hours" data-threshold="10800"><span class="slr-badge-icon">🔥</span><strong>Focus builder</strong><small>3 hours studied this week</small></div><div class="slr-badge" data-kind="hours" data-threshold="14400"><span class="sl-badge-icon slr-badge-icon">🎯</span><strong>On target</strong><small>4 hours studied this week</small></div><div class="slr-badge" data-kind="hours" data-threshold="18000"><span class="slr-badge-icon">💎</span><strong>Consistency gem</strong><small>5 hours studied this week</small></div><div class="slr-badge" data-kind="hours" data-threshold="25200"><span class="slr-badge-icon">⚡</span><strong>Power session</strong><small>7 hours studied this week</small></div><div class="slr-badge" data-kind="streak" data-threshold="3"><span class="slr-badge-icon">🌤️</span><strong>Three-day spark</strong><small>3-day study streak</small></div><div class="slr-badge" data-kind="streak" data-threshold="7"><span class="slr-badge-icon">🗓️</span><strong>Week warrior</strong><small>7-day study streak</small></div><div class="slr-badge" data-kind="streak" data-threshold="14"><span class="slr-badge-icon">🏅</span><strong>Fortnight focus</strong><small>14-day study streak</small></div><div class="slr-badge" data-kind="streak" data-threshold="30"><span class="slr-badge-icon">👑</span><strong>Consistency royalty</strong><small>30-day study streak</small></div><div class="slr-badge" data-kind="streak" data-threshold="60"><span class="slr-badge-icon">🔥</span><strong>Steady Flame</strong><small>60-day study streak</small></div><div class="slr-badge" data-kind="streak" data-threshold="100"><span class="slr-badge-icon">🏆</span><strong>Century Scholar</strong><small>100-day study streak</small></div></div><p class="slr-small-note">Milestones use StudyLab&#39;s existing weekly totals. Streaks are saved in this browser only and count a room session of at least 10 minutes; they do not sync across devices.</p>';
 layout.insertAdjacentElement('afterend',achievements);
 const localKey='studylab-room-streak-v1',today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const yesterday=key=>{const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);};
 const read=()=>{try{return JSON.parse(localStorage.getItem(localKey)||'{"lastDay":"","count":0}')}catch(_){return{lastDay:'',count:0}}};
 const renderStreak=()=>{const s=read();let n=Number(s.count)||0;if(s.lastDay&&s.lastDay!==today()&&s.lastDay!==yesterday(today()))n=0;document.getElementById('slrStreakValue').textContent=n+'-day streak';document.getElementById('slrStreakCaption').textContent=s.lastDay===today()?'Qualifying room session completed today.':'Complete a 10-minute room session to continue your streak.';achievements.querySelectorAll('.slr-badge[data-kind="streak"]').forEach(b=>b.classList.toggle('is-earned',n>=Number(b.dataset.threshold)));};
 const qualify=()=>{const day=today(),s=read();if(s.lastDay!==day){s.count=s.lastDay===yesterday(day)?(Number(s.count)||0)+1:1;s.lastDay=day;try{localStorage.setItem(localKey,JSON.stringify(s))}catch(_){}}renderStreak();};
 const weeklySeconds=()=>{const t=document.getElementById('weeklyHours')?.textContent.trim()||'',m=t.match(/^(\d{2,}):(\d{2}):(\d{2})$/);return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3]):0;};
 const renderAchievements=()=>{const s=weeklySeconds(),target=7*3600,pct=Math.min(100,Math.round(s/target*100));document.getElementById('slrWeeklyProgressText').textContent=Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m / 7 hours';document.getElementById('slrWeeklyProgressBar').style.width=pct+'%';document.getElementById('slrWeeklyProgress').setAttribute('aria-valuenow',String(Math.min(7,s/3600)));achievements.querySelectorAll('.slr-badge[data-kind="hours"]').forEach(b=>b.classList.toggle('is-earned',s>=Number(b.dataset.threshold)));};
 let startedAt=null;const status=document.getElementById('yourStatus');if(status?.textContent.trim()==='Studying')startedAt=Date.now();
 if(status)new MutationObserver(()=>{const v=status.textContent.trim();if(v==='Studying'&&!startedAt)startedAt=Date.now();if(v!=='Studying'&&startedAt){const elapsed=Date.now()-startedAt;startedAt=null;if(elapsed>=600000)qualify();}}).observe(status,{childList:true,characterData:true,subtree:true});
 renderStreak();renderAchievements();const weekly=document.getElementById('weeklyHours');if(weekly)new MutationObserver(renderAchievements).observe(weekly,{childList:true,characterData:true,subtree:true});setInterval(renderAchievements,15000);
 const decorate=()=>{
  if(!board)return;
  const isDaily=document.getElementById('dailyBoardTab')?.classList.contains('active');
  const period='Today';
  const rankedRows=[...board.querySelectorAll('.room-rank')];
  let winner=null,winnerScore=0;
  rankedRows.forEach((row,i)=>{
   row.classList.remove('slr-podium-1','slr-podium-2','slr-podium-3');
   if(i<3)row.classList.add('slr-podium-'+(i+1));
   const time=row.querySelector('.room-time')?.textContent.trim()||'';
   const match=time.match(/^(\d+):(\d{2}):(\d{2})$/);
   const score=match?Number(match[1])*3600+Number(match[2])*60+Number(match[3]):0;
   if(isDaily&&!winner&&score>0){winner=row;winnerScore=score;}
  });
  rankedRows.forEach(row=>{
   const avatar=row.querySelector('.room-avatar');
   const info=row.querySelector('.room-rank-info');
   if(!avatar||!info)return;
   let title=info.querySelector('.slr-leader-title');
   const gender=avatar.classList.contains('room-avatar-female')?'female':avatar.classList.contains('room-avatar-male')?'male':'';
   if(row!==winner||winnerScore<=0||!gender){
    avatar.classList.remove('slr-crown-avatar');
    avatar.removeAttribute('data-slr-crown');
    title?.remove();
    return;
   }
   const isQueen=gender==='female';
   const crown=isQueen?'♕':'♛';
   const label=isQueen?'Study Queen':'Study King';
   avatar.classList.add('slr-crown-avatar');
   avatar.setAttribute('data-slr-crown',crown);
   avatar.setAttribute('aria-label',label);
   if(!title){title=document.createElement('span');title.className='slr-leader-title';info.append(title);}
   if(title.textContent!==label)title.textContent=label;
  });
 }; if(board)new MutationObserver(decorate).observe(board,{childList:true,subtree:true});document.getElementById('weeklyBoardTab')?.addEventListener('click',()=>setTimeout(decorate,0));document.getElementById('dailyBoardTab')?.addEventListener('click',()=>setTimeout(decorate,0));decorate();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();