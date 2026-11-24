(function(){
  "use strict";
  const engine=window.StudyLabGuardianRules, KEY="studylab-guardian-preview-v1";
  const e=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const paths={
    shield:["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z","m9 12 2 2 4-4"],
    chat:["M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z"],
    layers:["m12 3 9 5-9 5-9-5 9-5Z","m3 12 9 5 9-5","m3 16 9 5 9-5"],
    link:["M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7-7l-2 2","M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7 7l2-2"],
    zap:["m13 2-9 12h7l-1 8 10-12h-7l1-8Z"],
    spark:["m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z","M19 15v6","M16 18h6","M5 2v4","M3 4h4"],
    lab:["M9 3h6","M10 3v7L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3","M8 15h8"],
    clock:["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z","M12 6v6l4 2"],
    refresh:["M20 11a8 8 0 0 0-14-5L3 9","M3 3v6h6","M4 13a8 8 0 0 0 14 5l3-3","M21 21v-6h-6"]
  };
  function icon(name){
    const ns="http://www.w3.org/2000/svg", s=document.createElementNS(ns,"svg");
    for(const [k,v] of Object.entries({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"1.7","stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true",focusable:"false"}))s.setAttribute(k,v);
    for(const d of paths[name]||paths.shield){const p=document.createElementNS(ns,"path");p.setAttribute("d",d);s.append(p);}
    return s;
  }
  function btn(text,fn,primary=false,symbol){
    const b=e("button",undefined,primary?"sladmin-primary":"slg-secondary");b.type="button";
    if(symbol)b.append(icon(symbol));b.append(e("span",text));b.addEventListener("click",async()=>{if(b.disabled)return;b.disabled=true;try{await fn();}finally{b.disabled=false;}});return b;
  }
  function card(title,description,symbol){
    const box=e("section",undefined,"slg-card"), head=e("div",undefined,"slg-card-head"), mark=e("span",undefined,"slg-icon"), copy=e("div");
    mark.append(icon(symbol));copy.append(e("h3",title),e("p",description));head.append(mark,copy);box.append(head);return box;
  }
  function field(title,control){const l=e("label",undefined,"slg-field");l.append(e("span",title),control);return l;}
  function status(node,message,tone="neutral"){node.textContent=message;node.dataset.tone=tone;}
  async function render(host,api){
    const wrap=e("div",undefined,"sladmin-guardian-panel"), live=!api.preview&&!api.connectedPreview;
    host.append(wrap);
    const hero=e("section",undefined,"slg-hero"), lead=e("div",undefined,"slg-hero-lead"), mark=e("span",undefined,"slg-hero-icon"), copy=e("div");
    mark.append(icon("shield"));copy.append(e("div","COMMUNITY SAFETY","slg-kicker"),e("h3","StudyLab Guardian"),e("p","Manage moderation for chat, posts and comments."));
    lead.append(mark,copy);const mode=e("span",live?"Loading settings":"Preview sandbox","slg-status");mode.dataset.tone="neutral";hero.append(lead,mode);wrap.append(hero);
    const summary=e("div",undefined,"slg-summary"), cards=[];
    for(const title of ["Protection","AI text moderation","Images & files"]){const a=e("div",undefined,"slg-stat");const v=e("strong","—");a.append(e("span",title),v);summary.append(a);cards.push(v);}
    wrap.append(summary);
    let settings,connected=false,loadFailed=false;
    try{settings=engine.normalize(live?await api.guardianSettings():JSON.parse(localStorage.getItem(KEY)||"{}"));connected=live;}
    catch(err){settings=engine.normalize({});loadFailed=live;}
    if(!wrap.isConnected)return;
    let saved={...settings};
    const describe=()=>{
      mode.textContent=loadFailed?"Settings unavailable":live?"Live controls":"Preview sandbox";
      mode.dataset.tone=loadFailed?"warn":live?"live":"neutral";
      cards[0].textContent=loadFailed?"Unknown":live?(saved.enabled?"Enabled":"Disabled"):(saved.enabled?"Simulated ON":"Simulated OFF");
      cards[1].textContent=loadFailed?"Unknown":saved.enabled&&saved.ai?(live?"Enabled":"Simulated ON"):"Off";
      cards[2].textContent="Not screened";
    };
    describe();
    const layout=e("div",undefined,"slg-layout"), controls=card("Protection controls",live?"Changes apply after saving to the server.":"Changes stay on this device; students are unaffected.","shield"), lab=card("Moderation test lab","Try fictional examples without publishing them.","lab");
    layout.append(controls,lab);wrap.append(layout);
    const msg=e("p","No unsaved changes.","slg-feedback");msg.setAttribute("role","status");
    const specs=[
      ["enabled","Guardian master switch","Enable or disable all configured protections.","shield"],
      ["chat","Chat messages","Screen new messages and edits.","chat"],
      ["posts","Social posts","Apply rules to new post text.","layers"],
      ["comments","Social comments","Apply rules to new comments.","chat"],
      ["links","Suspicious URL structure","Detect certain misleading or unsafe URL patterns.","link"],
      ["spam","Flood protection","Limit excessive recent submissions.","zap"],
      ["ai","AI public-text moderation","Screen submitted public text with OpenAI.","spark"]
    ];
    const inputs=new Map();
    function syncInputs(){for(const [key,input] of inputs){input.checked=settings[key];input.disabled=loadFailed;}}
    function toggle(key,label,description,symbol){
      const line=e("label",undefined,"slg-toggle"), m=e("span",undefined,"slg-mini-icon"), info=e("span",undefined,"slg-toggle-copy"), switchWrap=e("span",undefined,"slg-switch"), input=e("input");
      m.append(icon(symbol));info.append(e("strong",label),e("small",description));input.type="checkbox";input.setAttribute("role","switch");input.setAttribute("aria-label",label);input.checked=settings[key];input.disabled=loadFailed;inputs.set(key,input);
      input.onchange=()=>{settings[key]=input.checked;const dirty=Object.keys(settings).some(k=>settings[k]!==saved[k]);status(msg,dirty?"Unsaved changes.":"No unsaved changes.",dirty?"warn":"neutral");};
      switchWrap.append(input,e("span",undefined,"slg-track"));line.append(m,info,switchWrap);return line;
    }
    const master=e("div",undefined,"slg-master");master.append(toggle(...specs[0]));controls.append(master);
    const group=(title,items)=>{const g=e("div",undefined,"slg-group");g.append(e("div",title,"slg-group-label"));for(const spec of items)g.append(toggle(...spec));controls.append(g);};
    group("COMMUNITY AREAS",specs.slice(1,4));group("DETECTION MODULES",specs.slice(4));
    const actions=e("div",undefined,"slg-save"), save=btn("Save bot settings",async()=>{try{
      if(live){if(!connected)throw Error("Server settings unavailable.");if(!confirm("Save Guardian settings for all students? AI sends public text to OpenAI and may reject messages. Images and files are not screened."))return;settings=engine.normalize(await api.guardianSettings({...settings}));}
      else{localStorage.setItem(KEY,JSON.stringify(settings));}
      saved={...settings};syncInputs();describe();status(msg,live?"Saved live settings.":"Saved test settings on this device.","ok");
    }catch(err){status(msg,err.message,"warn");}},true);
    save.disabled=loadFailed;actions.append(msg,save);controls.append(actions);
    if(loadFailed)status(msg,"Server settings unavailable. You can still use the test lab.","warn");
    const wordEngine=window.StudyLabGuardianWords, wordKey="studylab-guardian-words-preview-v1";
    const wordsCard=card("Custom word filter","Add English, Singlish or Sinhala words and phrases that AI may miss.","chat");
    const wordInfo=e("p","Loading custom word settings…","slg-note");
    const wordEnabled=e("input");wordEnabled.type="checkbox";wordEnabled.setAttribute("role","switch");wordEnabled.setAttribute("aria-label","Custom word filter");
    const wordLabel=e("label",undefined,"slg-toggle"),wordCopy=e("span",undefined,"slg-toggle-copy"),wordSwitch=e("span",undefined,"slg-switch");
    wordCopy.append(e("strong","Custom word filter"),e("small","Requires Guardian master switch and the relevant community area."));wordSwitch.append(wordEnabled,e("span",undefined,"slg-track"));wordLabel.append(wordCopy,wordSwitch);
    const wordText=e("textarea");wordText.rows=6;wordText.maxLength=25000;wordText.placeholder="One word or phrase per line…";wordText.setAttribute("aria-label","Custom blocked words");
    const wordCount=e("small","0 / 200 entries","slg-count"),wordFeedback=e("p","","slg-feedback");wordFeedback.setAttribute("role","status");
    let wordState={enabled:false,words:[],version:0},wordAvailable=false;
    function readWordDraft(){return wordEngine.parse(wordText.value);}
    function refreshWordCount(){try{wordCount.textContent=readWordDraft().length+" / 200 entries";}catch(err){wordCount.textContent=err.message;}}
    function showWordState(){wordEnabled.checked=wordState.enabled;wordText.value=wordState.words.join("\n");refreshWordCount();}
    function updateWordDraft(){refreshWordCount();status(wordFeedback,"Unsaved word-list changes.","warn");}
    wordText.addEventListener("input",updateWordDraft);wordEnabled.addEventListener("change",updateWordDraft);
    const wordSave=btn("Save word list",async()=>{try{
      if(!wordAvailable)throw Error("Custom word database module is unavailable.");
      const next={enabled:wordEnabled.checked,words:readWordDraft(),version:wordState.version};
      if(live){if(!confirm("Save the custom word filter for all students?"))return;wordState=await api.guardianWords(next);}
      else{localStorage.setItem(wordKey,JSON.stringify(next));wordState=next;}
      showWordState();status(wordFeedback,live?"Saved live word filter.":"Saved preview word filter on this device.","ok");
    }catch(err){status(wordFeedback,err.message,"warn");}},true);
    wordSave.disabled=true;wordEnabled.disabled=true;wordText.disabled=true;
    const wordActions=e("div",undefined,"slg-save");wordActions.append(wordFeedback,wordSave);
    wordsCard.append(wordInfo,wordLabel,field("Blocked words and phrases · one per line",wordText),wordCount,e("p","Case-insensitive whole-word and phrase matching. Punctuation between words is normalized. Avoid common academic terms: this is a literal list, not a context-aware model.","slg-note"),wordActions);
    wrap.append(wordsCard);
    try{
      const stored=live?await api.guardianWords():JSON.parse(localStorage.getItem(wordKey)||"null");
      if(stored){wordState={enabled:stored.enabled===true,words:wordEngine.parse((stored.words||[]).join("\n")),version:Number(stored.version)||0};}
      if(!wrap.isConnected)return;
      wordAvailable=true;wordEnabled.disabled=false;wordText.disabled=false;wordSave.disabled=false;showWordState();
      wordInfo.textContent=live?"Live word list · Changes apply only after saving.":"Preview list · Saved on this device; no production changes.";
    }catch(err){wordInfo.textContent="Custom word settings unavailable. Existing Guardian controls still work.";status(wordFeedback,"Database module is not installed or access failed.","warn");}
    const text=e("textarea");text.rows=5;text.maxLength=2000;text.placeholder="Enter a fictional test message…";text.setAttribute("aria-label","Synthetic test message");
    const counter=e("small","0 / 2000","slg-count");text.addEventListener("input",()=>{counter.textContent=text.value.length+" / 2000";});
    const surface=e("select");for(const [key,label] of [["chat","Chat messages"],["posts","Social posts"],["comments","Social comments"]]){const opt=e("option",label);opt.value=key;surface.append(opt);}surface.setAttribute("aria-label","Test surface");
    const count=e("input");count.type="number";count.min="0";count.max="100";count.value="0";count.setAttribute("aria-label","Simulated recent submissions");
    const fields=e("div",undefined,"slg-fields");fields.append(field("Test surface",surface),field("Recent submissions (simulated)",count));
    const media=e("input");media.type="checkbox";const ml=e("label",undefined,"slg-media");ml.append(media,e("span","Simulate attachment requiring review"));
    const result=e("div",undefined,"slg-result");result.setAttribute("role","status");result.dataset.tone="neutral";const resultTitle=e("strong","Ready to test"),resultCopy=e("p","Results will appear here. Nothing is published.");result.append(resultTitle,resultCopy);
    function report(title,detail,tone="neutral"){resultTitle.textContent=title;resultCopy.textContent=detail;result.dataset.tone=tone;}
    let busy=false;
    const run=async work=>{if(busy)return;busy=true;try{await work();}finally{busy=false;}};
    const testButtons=e("div",undefined,"slg-test-actions");
    testButtons.append(btn("Run rules test",()=>run(async()=>{try{
      if(wordAvailable&&settings.enabled&&settings[surface.value]&&wordEnabled.checked&&wordEngine.matches(text.value,readWordDraft())){report("BLOCKED","Matches a custom word or phrase (current draft list).","warn");return;}
      const r=engine.classify({text:text.value,surface:surface.value,recentCount:Math.min(100,Math.max(0,Number(count.value)||0)),hasMedia:media.checked},settings);
      report(r.decision==="allow"?"Allowed":r.decision.toUpperCase(),r.reason,r.decision==="allow"?"ok":"warn");
    }catch(err){report("Test unavailable",err.message,"warn");}})),btn("Test server AI (synthetic text only)",()=>run(async()=>{
      if(!text.value.trim()){report("Enter a fictional test message first.","No request was sent.","warn");return;}
      report("Checking AI connection…","The fictional text is being checked.");
      try{
        const r=await api.guardianPreview({action:"ai-test",text:text.value});
        if(r?.status!=="classified"){report("AI not available",r?.status||"unknown response","warn");return;}
        report(r.flagged?"AI result: REVIEW":"AI result: not flagged",(r.categories||[]).length?r.categories.join(", "):"No category flags returned.",r.flagged?"warn":"ok");
      }catch(err){report("AI test unavailable",err.message,"warn");}
    }),true,"spark"));
    lab.append(fields,field("Test message",text),counter,ml,testButtons,result,e("p","Rules tests are simulations. Server AI tests send only the fictional text entered above and work independently of the master switch.","slg-note"));
    const history=card("Recent AI blocks","Recent server moderation decisions; no message text is retained here.","clock"), list=e("div",undefined,"slg-history-list");
    if(connected){
      const refresh=btn("Refresh history",async()=>{list.replaceChildren(e("p","Loading history…","slg-empty"));try{
        const entries=await api.guardianHistory();
        list.replaceChildren();if(!entries.length){list.append(e("p","No AI blocks recorded.","slg-empty"));return;}
        for(const x of entries){const row=e("div",undefined,"slg-history-row"), body=e("div");body.append(e("strong",String(x.reason||"AI block")),e("small",new Date(x.created_at).toLocaleString()));row.append(body,e("span",String(x.surface||"unknown"),"slg-history-tag"));list.append(row);}
      }catch(err){list.replaceChildren(e("p",err.message,"slg-empty"));}},false,"refresh");
      history.append(refresh);list.append(e("p","Refresh history to view recent AI blocks.","slg-empty"));
    }else{list.append(e("p","Live history is available in the production admin dashboard.","slg-empty"));}
    history.append(list);wrap.append(history,e("p","Image and file screening, URL reputation checks, and automatic penalties are not enabled.","slg-footnote"));
  }
  window.StudyLabGuardianPanel=Object.freeze({render});
})();
