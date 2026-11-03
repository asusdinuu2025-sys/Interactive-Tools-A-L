(function () {
"use strict";
const account=window.StudyLabAccount;if(!account)return;
const root=document.createElement("div");root.id="studylab-auth-gateway";root.hidden=true;
const systemTheme=window.matchMedia?window.matchMedia("(prefers-color-scheme: light)"):null;
function syncAuthTheme(){root.dataset.authTheme=systemTheme&&systemTheme.matches?"light":"dark";}
syncAuthTheme();
if(systemTheme){if(systemTheme.addEventListener)systemTheme.addEventListener("change",syncAuthTheme);else if(systemTheme.addListener)systemTheme.addListener(syncAuthTheme);}
root.innerHTML=`
<div class="auth-glow auth-glow-a" aria-hidden="true"></div><div class="auth-glow auth-glow-b" aria-hidden="true"></div><div class="auth-pointer-glow" aria-hidden="true"></div><div class="auth-formula-field" aria-hidden="true"><span class="formula formula-one">F = ma</span><span class="formula formula-two">E = mc²</span><span class="formula formula-three">∫ f(x) dx</span><span class="formula formula-four">v = u + at</span><span class="formula formula-five">PV = nRT</span><span class="formula formula-six">sin²θ + cos²θ = 1</span><span class="formula formula-seven">λ = h / p</span></div>
<main class="auth-layout">
<section class="auth-story"><a class="auth-brand" href="/"><img src="/assets/icon/studylab-pwa.svg" alt=""> <span>StudyLab</span></a>
<div class="auth-story-copy"><p class="auth-eyebrow"><i></i> YOUR LEARNING SPACE</p><h1>All Resources for<br><em>G.C.E A/L Students</em><br>in One Place.</h1><p class="auth-story-subtitle">Make room for better learning.</p><p class="auth-story-description">A focused space for your A/L journey. Find learning resources, practical simulations, interactive tools and past papers, join live study sessions in the Live Study Room, and connect with the student community, all in one place.</p><div class="auth-stats" aria-label="StudyLab highlights"><div class="auth-stat"><strong data-count-to="1000" data-count-suffix="+">0+</strong><span>Students Visited</span></div><div class="auth-stat"><strong data-count-to="100" data-count-suffix="+">0+</strong><span>Practical Simulations</span></div></div></div>
<div class="auth-features"><span>Live Study Room</span><span>Social Community</span><span>Interactive Learning</span></div><i class="auth-ring auth-ring-a"></i><i class="auth-ring auth-ring-b"></i></section>
<section class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-heading">
<div class="auth-panel-shine"></div><div class="auth-panel-brand"><b>ツ</b><span>STUDYLAB ACCOUNT</span></div>
<div class="auth-screen" data-screen="welcome"><p class="auth-step">WELCOME</p><h2 id="auth-heading">Welcome to StudyLab</h2><p class="auth-desc">Choose how you would like to continue.</p><p class="auth-sinhala" lang="si">උසස් පෙළ සිසුන්ට අවශ්‍ය ඉගෙනුම් සම්පත්, පාඩම්, ප්‍රශ්න පත්‍ර සහ අධ්‍යයන මෙවලම් එකම තැනකින් පහසුවෙන් ලබාගන්න.</p>
<div class="auth-options">
<button class="auth-option" data-action="signup"><i class="auth-option-icon">＋</i><span><b>New User</b><small>Create your StudyLab account</small></span><i class="auth-arrow">›</i></button>
<button class="auth-option" data-action="login"><i class="auth-option-icon auth-option-purple">↗</i><span><b>Existing User</b><small>Log in to your account</small></span><i class="auth-arrow">›</i></button></div>
<div class="auth-or"><span>OR</span></div><button class="auth-guest" data-action="guest"><span>Continue as Guest</span><i aria-hidden="true">◉</i></button><p class="auth-note">Guest access stays available. Your session is remembered on this browser.</p></div>
<div class="auth-screen" data-screen="signup" hidden><button class="auth-back" data-action="back">← Back</button><p class="auth-step">NEW TO STUDYLAB</p><h2>Create your account</h2><p class="auth-desc">Choose your Google account to get started. Your student profile comes next.</p><button class="auth-google" data-action="google-signup"><span class="auth-google-mark">G</span><b>Continue with Google</b><i>→</i></button><p class="auth-secure">◇ Secure sign-in powered by Google</p></div>
<div class="auth-screen" data-screen="login" hidden><button class="auth-back" data-action="back">← Back</button><p class="auth-step">WELCOME BACK</p><h2>Log in to StudyLab</h2><p class="auth-desc">Continue with the Google account you used when joining StudyLab.</p><button class="auth-google" data-action="google-login"><span class="auth-google-mark">G</span><b>Continue with Google</b><i>→</i></button><p class="auth-secure">◇ Your account and profile stay together</p></div>
<div class="auth-status" role="status" aria-live="polite" hidden></div><footer class="auth-footer"><i></i> STUDY SMART. STAY CURIOUS. <i></i></footer>
</section></main>`;
document.body.appendChild(root);
const status=root.querySelector(".auth-status"),screens=[...root.querySelectorAll("[data-screen]")],buttons=[...root.querySelectorAll("[data-action]")],panel=root.querySelector(".auth-panel");
const finePointer=window.matchMedia&&window.matchMedia("(hover: hover) and (pointer: fine)").matches;
if(finePointer){
  root.addEventListener("pointermove",e=>{
    const bounds=root.getBoundingClientRect();
    root.style.setProperty("--auth-pointer-x",(e.clientX-bounds.left)+"px");
    root.style.setProperty("--auth-pointer-y",(e.clientY-bounds.top)+"px");
    const card=panel.getBoundingClientRect();
    const nx=(e.clientX-card.left)/card.width-.5,ny=(e.clientY-card.top)/card.height-.5;
    if(e.clientX>=card.left-35&&e.clientX<=card.right+35&&e.clientY>=card.top-35&&e.clientY<=card.bottom+35){
      panel.style.setProperty("--auth-tilt-x",(-ny*5.5).toFixed(2)+"deg");
      panel.style.setProperty("--auth-tilt-y",(nx*6.5).toFixed(2)+"deg");
    }else{
      panel.style.setProperty("--auth-tilt-x","0deg");
      panel.style.setProperty("--auth-tilt-y","0deg");
    }
  });
  root.addEventListener("pointerleave",()=>{
    panel.style.setProperty("--auth-tilt-x","0deg");
    panel.style.setProperty("--auth-tilt-y","0deg");
  });
}
function view(name){screens.forEach(x=>x.hidden=x.dataset.screen!==name);status.hidden=true;status.textContent="";}
function message(s,type="error"){status.textContent=s;status.dataset.type=type;status.hidden=!s;}
function busy(v){buttons.forEach(b=>b.disabled=v);}
function close(){root.classList.add("auth-leaving");window.setTimeout(()=>root.hidden=true,280);}
async function google(intent){busy(true);message("Connecting securely to Google…","info");try{await account.signInWithGoogle(intent);}catch(e){console.warn("StudyLab Google sign-in:",e);busy(false);message("Google sign-in is unavailable right now. Please try again.");}}
async function guest(){busy(true);message("Preparing your Guest session…","info");try{await account.continueAsGuest();close();}catch(e){console.warn("StudyLab Guest sign-in:",e);busy(false);message("Guest access could not start. Check your connection and try again.");}}
root.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b||b.disabled)return;switch(b.dataset.action){case"signup":view("signup");break;case"login":view("login");break;case"back":view("welcome");break;case"guest":guest();break;case"google-signup":google("signup");break;case"google-login":google("login");break;}});
let countersAnimated=false;
function animateCounters(){if(countersAnimated)return;countersAnimated=true;const nodes=[...root.querySelectorAll("[data-count-to]")];const reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;const duration=850;const start=performance.now();function frame(now){const progress=reduced?1:Math.min(1,(now-start)/duration);const eased=1-Math.pow(1-progress,3);nodes.forEach(node=>{const target=Number(node.dataset.countTo)||0;node.textContent=new Intl.NumberFormat().format(Math.round(target*eased))+(node.dataset.countSuffix||"");});if(progress<1)requestAnimationFrame(frame);}requestAnimationFrame(frame);}
function show(){root.hidden=false;root.classList.remove("auth-leaving");animateCounters();requestAnimationFrame(()=>root.classList.add("auth-visible"));if(account.getStartupError?.()==="no-profile"){view("login");message("This Google account does not have a StudyLab profile yet. Choose New User to create one.","info");}else if(account.getStartupError?.()){message("StudyLab could not restore your saved session. Check your connection and choose an option to continue.");}if(new URLSearchParams(location.search).has("error_description"))message("Google sign-in was cancelled or could not be completed. Please try again.");}
if(account.startup&&typeof account.startup.then==="function")account.startup.then(ok=>{if(!ok)show();});else show();
})();