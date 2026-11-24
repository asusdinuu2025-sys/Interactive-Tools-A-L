/* Public-text moderation preflight. The database independently requires the server's one-use approval. */
(function(){
  "use strict";
  let noticePending=null,accepted=false;
  window.StudyLabGuardianNotice=async function(){
    let seen=accepted;try{seen=seen||sessionStorage.getItem("studylab-guardian-notice-v1")==="yes";}catch(_){}
    if(seen)return;
    if(!noticePending)noticePending=new Promise(resolve=>{
      const d=window.document,dialog=d.createElement("dialog");dialog.className="sl-guardian-notice";dialog.setAttribute("aria-label","Community safety notice");
      const h=d.createElement("h2");h.textContent="A quick privacy reminder";
      const p=d.createElement("p");p.textContent="StudyLab uses automated safety screening for public messages and posts. Submitted text is sent to OpenAI for moderation. Please do not include private contact details or sensitive personal information.";
      const buttons=d.createElement("div");buttons.className="sl-guardian-notice-actions";
      const cancel=d.createElement("button"),ok=d.createElement("button");cancel.type=ok.type="button";cancel.textContent="Cancel";ok.textContent="Continue";ok.className="is-primary";
      let done=false;const prior=d.activeElement;
      const finish=value=>{if(done)return;done=true;dialog.remove();prior?.focus?.({preventScroll:true});resolve(value);};
      cancel.onclick=e=>{e.stopPropagation();finish(false);};ok.onclick=e=>{e.stopPropagation();finish(true);};
      dialog.addEventListener("cancel",e=>{e.preventDefault();e.stopPropagation();finish(false);});
      dialog.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();e.preventDefault();finish(false);}});
      buttons.append(cancel,ok);dialog.append(h,p,buttons);d.body.append(dialog);
      try{dialog.showModal();cancel.focus();}catch(_){dialog.setAttribute("open","");dialog.classList.add("sl-guardian-fallback");cancel.focus();}
    }).then(value=>{if(value){accepted=true;try{sessionStorage.setItem("studylab-guardian-notice-v1","yes");}catch(_){}}return value;}).finally(()=>{noticePending=null;});
    if(!await noticePending)throw Error("Guardian: message not submitted.");
  };
  window.StudyLabGuardianCheck=async function(client,surface,text){
    const mode=await client.rpc("studylab_guardian_mode",{p_surface:surface});
    if(mode.error)throw Error("Guardian: safety service unavailable. Please retry.");
    if(mode.data!==true)return;
    await window.StudyLabGuardianNotice();
    const result=await client.functions.invoke("studylab-guardian-live",{body:{surface,text}});
    if(result.error)throw Error("Guardian: safety service unavailable. Please retry.");
    if(result.data?.status==="blocked")throw Error("Guardian: this text was flagged by safety checks. Edit it or contact a moderator if you believe this is a mistake.");
    if(result.data?.status==="rate")throw Error("Guardian: too many recent submissions. Please try again shortly.");
    if(!["allowed","off"].includes(result.data?.status))throw Error("Guardian: safety service unavailable. Please retry.");
  };
})();
