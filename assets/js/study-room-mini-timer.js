/* StudyLab floating timer. Uses the same authoritative session controls as the main room. */
(() => {
  "use strict";
  const api=window.StudyRoomTimer;
  if(!api||document.getElementById("slMiniTimerLauncher"))return;
  const launcher=document.createElement("button");
  launcher.id="slMiniTimerLauncher";launcher.className="sl-mini-timer-launcher";launcher.type="button";
  launcher.setAttribute("aria-label","Open mini study timer");launcher.setAttribute("aria-expanded","false");
  launcher.innerHTML='<span aria-hidden="true">◱</span><span>Mini timer</span>';document.body.append(launcher);
  const panel=document.createElement("aside");panel.className="sl-mini-timer-panel";panel.hidden=true;
  panel.setAttribute("aria-label","Floating study timer");
  panel.innerHTML='<div class="sl-mini-timer-head"><strong>StudyLab timer</strong><div class="sl-mini-head-actions"><button type="button" class="sl-mini-detach" aria-label="Open independent timer window" title="Keep timer running in a separate window">↗</button><button type="button" class="sl-mini-close" aria-label="Close mini timer">×</button></div></div><div class="sl-mini-timer-clock" role="timer">00:00:00</div><div class="sl-mini-timer-status">Connecting…</div><div class="sl-mini-timer-actions"><button type="button" data-action="start">Start</button><button type="button" data-action="pause">Pause</button><button type="button" data-action="end">End</button></div><div class="sl-mini-timer-hint">Drag this panel by its title bar</div>';document.body.append(panel);
  const fmt=s=>{s=Math.max(0,Math.floor(Number(s)||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}h${m?` ${m}m`:""}`:`${m}m`;};
  function paint(root,state){if(!root||!state)return;const clock=root.querySelector(".sl-mini-timer-clock,.clock"),status=root.querySelector(".sl-mini-timer-status,.status");if(clock)clock.textContent=fmt(state.elapsedSeconds);if(status)status.textContent=state.ready?state.status+(state.subject?" · "+state.subject:""):"Connecting to your Study Room…";root.querySelectorAll("[data-action]").forEach(button=>{const action=button.dataset.action;button.disabled=!state.ready||(action==="start"?state.isStudying:action==="pause"?!state.isStudying:!state.sessionActive);});}
  async function run(action){try{await api[action]();}catch(error){console.error("StudyLab mini timer action failed",error);}}
  let standaloneWindow=null;
  function openIndependentWindow(opener=window){
    if(standaloneWindow&&!standaloneWindow.closed){standaloneWindow.focus();return;}
    standaloneWindow=opener.open("study-room-mini.html","StudyLabIndependentTimer","popup,width=350,height=245,resizable=yes");
    if(standaloneWindow)standaloneWindow.focus();
    else{
      panel.hidden=false;
      launcher.setAttribute("aria-expanded","true");
      const hint=panel.querySelector(".sl-mini-timer-hint");
      if(hint)hint.textContent="Allow pop-ups to keep the timer in a separate window.";
    }
  }
  function bind(root,close){root.querySelector(".sl-mini-close")?.addEventListener("click",close);root.querySelector(".sl-mini-detach")?.addEventListener("click",openIndependentWindow);root.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>run(button.dataset.action)));paint(root,api.getState());}
  bind(panel,()=>{panel.hidden=true;launcher.setAttribute("aria-expanded","false");});
  let pipWindow=null;
  async function openPictureInPicture(){if(pipWindow&&!pipWindow.closed){pipWindow.focus();return;}try{pipWindow=await window.documentPictureInPicture.requestWindow({width:310,height:205});window.StudyRoomPresenceController?.addWindow(pipWindow);const doc=pipWindow.document;doc.title="StudyLab Mini Timer";doc.documentElement.dataset.theme=document.documentElement.dataset.theme||"dark";doc.body.className=document.body.className;const style=doc.createElement("style");style.textContent=`
    *{box-sizing:border-box}body{margin:0;padding:12px;background:#0b1220;color:#edf5ff;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}body.slr-theme-light{background:#eef3fa;color:#17233b}
    .pip{border:1px solid rgba(126,220,255,.22);border-radius:17px;padding:13px;background:rgba(20,34,54,.96);box-shadow:0 12px 34px rgba(0,0,0,.24)}body.slr-theme-light .pip{background:rgba(255,255,255,.97);border-color:rgba(60,90,130,.2)}
    .head{display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:13px}.head-actions{display:flex;gap:5px}.head-actions button{width:27px;height:27px;border:0;border-radius:8px;background:rgba(120,135,160,.15);color:inherit;font-size:17px;cursor:pointer}.close{border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer}.clock{text-align:center;font-size:35px;font-weight:850;letter-spacing:.02em;font-variant-numeric:tabular-nums;margin:9px 0 2px}.status{text-align:center;color:#8da2bd;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.actions button{border:1px solid rgba(126,220,255,.2);border-radius:9px;padding:8px 3px;background:rgba(126,220,255,.09);color:inherit;font-weight:750;cursor:pointer}.actions button:first-child{background:linear-gradient(135deg,#26b98d,#168b78);color:white;border:0}.actions button:disabled{opacity:.35;cursor:not-allowed}
  `;doc.head.append(style);doc.body.innerHTML='<section class="pip"><div class="head"><strong>StudyLab timer</strong><div class="head-actions"><button class="detach" type="button" aria-label="Open independent timer window" title="Keep timer running in a separate window">↗</button><button class="close" type="button" aria-label="Close">×</button></div></div><div class="clock">00:00:00</div><div class="status">Connecting…</div><div class="actions"><button data-action="start">Start</button><button data-action="pause">Pause</button><button data-action="end">End</button></div></section>';const root=doc.querySelector(".pip");doc.querySelector(".close").addEventListener("click",()=>pipWindow?.close());doc.querySelector(".detach").addEventListener("click",()=>openIndependentWindow(pipWindow));doc.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>run(button.dataset.action)));paint(root,api.getState());pipWindow.setInterval(()=>{if(pipWindow&&!pipWindow.closed)paint(pipWindow.document.querySelector('.pip'),api.getState());},1000);pipWindow.addEventListener("pagehide",()=>{pipWindow=null;});launcher.setAttribute("aria-expanded","true");}catch(error){console.info("Document Picture-in-Picture unavailable; using the in-page mini timer.",error);panel.hidden=false;launcher.setAttribute("aria-expanded","true");}}
  launcher.addEventListener("click",()=>{if(pipWindow&&!pipWindow.closed){pipWindow.focus();return;}if(window.documentPictureInPicture?.requestWindow)openPictureInPicture();else{panel.hidden=!panel.hidden;launcher.setAttribute("aria-expanded",String(!panel.hidden));}});
  const head=panel.querySelector(".sl-mini-timer-head");let drag=null;head.addEventListener("pointerdown",event=>{if(event.target.closest("button"))return;const rect=panel.getBoundingClientRect();drag={x:event.clientX-rect.left,y:event.clientY-rect.top};head.setPointerCapture(event.pointerId);});
  head.addEventListener("pointermove",event=>{if(!drag)return;panel.style.left=Math.max(4,event.clientX-drag.x)+"px";panel.style.top=Math.max(4,event.clientY-drag.y)+"px";panel.style.right="auto";panel.style.bottom="auto";});
  const stop=()=>{drag=null;};head.addEventListener("pointerup",stop);head.addEventListener("pointercancel",stop);
  window.addEventListener("studylab:study-room-timer",event=>{paint(panel,event.detail);if(pipWindow&&!pipWindow.closed)paint(pipWindow.document.querySelector(".pip"),event.detail);});
  setInterval(()=>{const state=api.getState();paint(panel,state);if(pipWindow&&!pipWindow.closed)paint(pipWindow.document.querySelector(".pip"),state);},1000);
  paint(panel,api.getState());
})();
