/* Public-text moderation preflight. The database independently requires the server's one-use approval. */
(function(){
  "use strict";
  window.StudyLabGuardianCheck=async function(client,surface,text){
    const mode=await client.rpc("studylab_guardian_mode",{p_surface:surface});
    if(mode.error)throw Error("Guardian: safety service unavailable. Please retry.");
    if(mode.data!==true)return;
    // Notice appears before the first external classification in this browser session.
    let seen=false;try{seen=sessionStorage.getItem("studylab-guardian-notice-v1")==="yes";}catch(_){}
    if(!seen){
      if(!window.confirm("StudyLab uses automated safety screening for public messages and posts. Your submitted text is sent to OpenAI for moderation. Do not include private contact details or sensitive personal information. Continue publishing?"))throw Error("Guardian: message not submitted.");
      try{sessionStorage.setItem("studylab-guardian-notice-v1","yes");}catch(_){}
    }
    const result=await client.functions.invoke("studylab-guardian-live",{body:{surface,text}});
    if(result.error)throw Error("Guardian: safety service unavailable. Please retry.");
    if(result.data?.status==="blocked")throw Error("Guardian: this text was flagged by safety checks. Edit it or contact a moderator if you believe this is a mistake.");
    if(result.data?.status==="rate")throw Error("Guardian: too many recent submissions. Please try again shortly.");
    if(!["allowed","off"].includes(result.data?.status))throw Error("Guardian: safety service unavailable. Please retry.");
  };
})();
