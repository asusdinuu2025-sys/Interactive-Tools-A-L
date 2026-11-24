(function(){
  "use strict";
  const engine=window.StudyLabGuardianRules, KEY="studylab-guardian-preview-v1";
  const e=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const btn=(text,fn)=>{const b=e("button",text,"sladmin-primary");b.type="button";b.addEventListener("click",async()=>{b.disabled=true;try{await fn();}finally{b.disabled=false;}});return b;};
  async function render(host,api){
    const wrap=e("div",undefined,"sladmin-guardian-panel");
    host.append(wrap);
    const live=!api.preview&&!api.connectedPreview;
    const state=e("p",live?"Loading server settings…":"Test mode · Switches are local simulations.");
    wrap.append(e("h3","StudyLab Guardian"),state);
    const msg=e("p");msg.setAttribute("role","status");
    let settings,connected=false;
    try{settings=engine.normalize(live?await api.guardianSettings():JSON.parse(localStorage.getItem(KEY)||"{}"));connected=live;}
    catch(err){settings=engine.normalize({});state.textContent="Server settings unavailable · no settings can be saved from this panel.";}
    const showState=()=>{if(connected)state.textContent="Live Guardian · "+(!settings.enabled?"OFF":settings.ai?"AI text + configured rules active":"Configured rules active · AI text OFF")+" · Images and files are not screened.";};showState();
    if(!wrap.isConnected)return;
    const labels={enabled:"Guardian master switch",chat:"Chat messages",posts:"Social posts",comments:"Social comments",links:"Suspicious URL structure",spam:"Flood protection",ai:"AI public-text moderation"};
    for(const [key,label] of Object.entries(labels)){
      const line=e("label",undefined,"sladmin-row"), input=e("input");input.type="checkbox";input.checked=settings[key];input.setAttribute("role","switch");input.onchange=()=>{settings[key]=input.checked;msg.textContent="Unsaved changes";};line.append(e("strong",label),input);wrap.append(line);
    }
    wrap.append(btn("Save bot settings",async()=>{try{
      if(live){if(!connected)throw Error("Server settings unavailable.");if(!confirm("Save Guardian settings for all students? AI sends public text to OpenAI and may reject messages. Images and files are not screened."))return;settings=engine.normalize(await api.guardianSettings(settings));showState();msg.textContent="Saved live settings.";}
      else{localStorage.setItem(KEY,JSON.stringify(settings));msg.textContent="Saved test settings on this device.";}
    }catch(err){msg.textContent=err.message;}}),msg);
    const area=e("div",undefined,"sladmin-row-copy"), text=e("textarea");text.rows=4;text.maxLength=2000;text.placeholder="Enter a fictional test message (no student data)";text.setAttribute("aria-label","Synthetic test message");
    const surface=e("select");for(const key of ["chat","posts","comments"]){const opt=e("option",key);opt.value=key;surface.append(opt);}surface.setAttribute("aria-label","Test surface");
    const count=e("input");count.type="number";count.min="0";count.max="100";count.value="0";count.setAttribute("aria-label","Simulated recent submissions");
    const media=e("input");media.type="checkbox";const ml=e("label"," Simulate attachment requiring review");ml.prepend(media);
    const result=e("p");result.setAttribute("role","status");
    const payload=()=>({text:text.value,surface:surface.value,recentCount:Math.min(100,Math.max(0,Number(count.value)||0)),hasMedia:media.checked});
    area.append(e("h3","Moderation test lab"),e("p","Use fictional examples only. Rule decisions are simulations only. Attachments are not scanned. The AI test sends only the fictional text you enter to the server."),surface,text,e("label","Recent submissions (simulated)"),count,ml,
      btn("Run rules test",async()=>{const r=engine.classify(payload(),settings);result.textContent=r.decision.toUpperCase()+" · "+r.reason;}),
      btn("Test server AI (synthetic text only)",async()=>{try{
        if(!text.value.trim()){result.textContent="Enter a fictional test message first.";return;}
        result.textContent="Checking AI connection…";
        const r=await api.guardianPreview({action:"ai-test",text:text.value});result.textContent=r?.status==="classified"?"AI result: "+(r.flagged?"REVIEW":"not flagged")+((r.categories||[]).length?" · "+r.categories.join(", "):""):"AI not available: "+(r?.status||"unknown response");
      }catch(err){result.textContent=err.message;}}),result);
    wrap.append(area,e("p","Image/file screening, URL reputation and automatic penalties are not enabled. The AI test is independent of the master switch."));
    if(connected){const list=e("div");wrap.append(e("h3","Recent AI blocks"),btn("Refresh history",async()=>{try{const entries=await api.guardianHistory();list.replaceChildren(...entries.map(x=>e("p",new Date(x.created_at).toLocaleString()+" · "+x.surface+" · "+x.reason)));if(!entries.length)list.append(e("p","No AI blocks recorded."));}catch(err){list.replaceChildren(e("p",err.message));}}),list);}
  }
  window.StudyLabGuardianPanel=Object.freeze({render});
})();
