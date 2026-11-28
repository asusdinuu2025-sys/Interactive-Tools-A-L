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
   const themeKey='studylab-room-appearance-v1',modeKey='studylab-study-room-mode-choice-v2',legacySharedModeKey='studylab-room-mode-v1';
   let savedTheme='midnight-blue',savedMode='system';
   try{const value=localStorage.getItem(themeKey);if(allowed.has(value))savedTheme=value;else if(legacy[value])savedTheme=legacy[value];const explicitMode=localStorage.getItem(modeKey);const olderRoomMode=value?localStorage.getItem(legacySharedModeKey):null;const mode=explicitMode||olderRoomMode;if(['light','dark','system'].includes(mode))savedMode=mode;}catch(_){}
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
    document.dispatchEvent(new CustomEvent('studylab:room-mode-change',{detail:{mode:choice,effective}}));
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

   // Decorative backdrop preference is local to Study Room and is ON unless
   // the user has explicitly disabled it. It never changes room sessions.
   const doodlesKey='studylab-room-doodles-v1';
   const doodlesButton=document.getElementById('roomDoodlesToggle');
   const applyDoodles=(enabled,save=false)=>{
    const on=Boolean(enabled);
    root.dataset.roomDoodles=on?'on':'off';
    if(doodlesButton){
     doodlesButton.setAttribute('aria-pressed',String(on));
     doodlesButton.setAttribute('aria-label',on?'Doodles on. Hide background doodles':'Doodles off. Show background doodles');
     doodlesButton.classList.toggle('is-selected',on);
     const state=doodlesButton.querySelector('.room-doodles-state');
     if(state && state.textContent!==(on?'On':'Off'))state.textContent=on?'On':'Off';
    }
    if(save){try{localStorage.setItem(doodlesKey,on?'on':'off')}catch(_){}}
   };
   applyDoodles(root.dataset.roomDoodles!=='off');
   doodlesButton?.addEventListener('click',()=>applyDoodles(root.dataset.roomDoodles!=='on',true));
   window.addEventListener('storage',event=>{
    if(event.key===doodlesKey)applyDoodles(event.newValue!=='off',false);
   });
   modeButtons.forEach(button=>button.addEventListener('click',()=>applyMode(button.dataset.roomModeChoice)));
   window.addEventListener('storage',event=>{if(event.key===modeKey&&['light','dark','system'].includes(event.newValue))applyMode(event.newValue,false);});
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
