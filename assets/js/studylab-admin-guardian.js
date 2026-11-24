(function(){
  "use strict";
  const engine=window.StudyLabGuardianRules, KEY="studylab-guardian-preview-v1";
  const e=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const btn=(text,fn)=>{const b=e("button",text,"sladmin-primary");b.type="button";b.addEventListener("click",async()=>{b.disabled=true;try{await fn();}finally{b.disabled=false;}});return b;};
  async function render(host,api){
    const wrap=e("div"), preview=api.preview||api.connectedPreview;
    host.append(wrap);
    wrap.append(e("h3","StudyLab Guardian"),e("p",preview?"Sandbox controls · Saved on this device only. No student messages or production settings are changed.":"Live rules · Changes affect new Social and chat writes. AI remains test-only."));
    const msg=e("p");msg.setAttribute("role","status");
    let settings;
    try{settings=engine.normalize(preview?JSON.parse(localStorage.getItem(KEY)||"{}"):await api.guardianSettings());}
    catch(err){if(!preview){wrap.append(e("p","Guardian database migration is not available. No live protection enabled."));return;}settings=engine.normalize({});}
    if(!wrap.isConnected)return;
    const labels={enabled:"Guardian master switch",chat:"Chat messages",posts:"Social posts",comments:"Social comments",links:"Suspicious URL structure",spam:"Flood protection"};
    for(const [key,label] of Object.entries(labels)){
      const line=e("label",undefined,"sladmin-row"), input=e("input");input.type="checkbox";input.checked=settings[key];input.setAttribute("role","switch");input.onchange=()=>{settings[key]=input.checked;msg.textContent="Unsaved changes";};line.append(e("strong",label),input);wrap.append(line);
    }
    wrap.append(btn("Save bot settings",async()=>{try{
      if(preview)localStorage.setItem(KEY,JSON.stringify(settings));
      else{if(!confirm("Save live Guardian rule settings?"))return;settings=engine.normalize(await api.guardianSettings(settings));}
      msg.textContent=preview?"Saved locally. Production unchanged.":"Saved server settings.";
    }catch(err){msg.textContent=err.message;}}),msg);
    const area=e("div",undefined,"sladmin-row-copy"), text=e("textarea");text.rows=4;text.maxLength=2000;text.placeholder="Enter a fictional test message (no student data)";text.setAttribute("aria-label","Synthetic test message");
    const surface=e("select");for(const key of ["chat","posts","comments"]){const opt=e("option",key);opt.value=key;surface.append(opt);}surface.setAttribute("aria-label","Test surface");
    const count=e("input");count.type="number";count.min="0";count.max="100";count.value="0";count.setAttribute("aria-label","Simulated recent submissions");
    const media=e("input");media.type="checkbox";const ml=e("label"," Simulate attachment requiring review");ml.prepend(media);
    const result=e("p");result.setAttribute("role","status");
    const payload=()=>({text:text.value,surface:surface.value,recentCount:Math.min(100,Math.max(0,Number(count.value)||0)),hasMedia:media.checked});
    area.append(e("h3","Moderation test lab"),e("p","Use fictional examples only. A review decision would reject a new write when live deterministic rules are enabled. Attachments are not scanned by these rules."),surface,text,e("label","Recent submissions (simulated)"),count,ml,
      btn("Run rules test",async()=>{const r=engine.classify(payload(),settings);result.textContent=r.decision.toUpperCase()+" · "+r.reason;}),
      btn("Test server AI (synthetic text only)",async()=>{try{
        const r=await api.guardianPreview({action:"ai-test",text:text.value});result.textContent=r.status==="classified"?"AI result: "+(r.flagged?"REVIEW":"not flagged")+" · "+(r.categories||[]).join(", "):"AI not available: "+r.status;
      }catch(err){result.textContent=err.message;}}),result);
    wrap.append(area,e("p","AI and image moderation are not active for students. URL reputation and automatic penalties are not enabled."));
  }
  window.StudyLabGuardianPanel=Object.freeze({render});
})();
