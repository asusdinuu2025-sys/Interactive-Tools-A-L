/* Shared deterministic preview rules; not a link reputation service. */
(function(root){
  "use strict";
  const defaults=Object.freeze({enabled:false,chat:true,posts:true,comments:true,links:true,spam:true,ai:false});
  const normalize=s=>Object.fromEntries(Object.keys(defaults).map(k=>[k,typeof s?.[k]==="boolean"?s[k]:defaults[k]]));
  function classify(input, settings){
    const s=normalize(settings), text=String(input?.text??""), surface=input?.surface||"chat";
    if(!["chat","posts","comments"].includes(surface))throw Error("Invalid surface");
    if(!s.enabled||!s[surface])return {decision:"allow",reason:"disabled"};
    if(s.links && /(?:javascript|vbscript|data):\s*(?:[a-z]|<)/i.test(text))
      return {decision:"review",reason:"unsafe URL scheme"};
    if(s.links && /https?:\/\/[^\s\/?#]+@[^\s\/?#]+/i.test(text))
      return {decision:"review",reason:"URL contains credentials or misleading host"};
    if(s.spam && Number(input?.recentCount)>= (surface==="chat"?12:surface==="posts"?4:8))
      return {decision:"review",reason:"rapid submissions"};
    if(input?.hasMedia)return {decision:"review",reason:"media not scanned"};
    return {decision:"allow",reason:"no rule matched"};
  }
  const a=Object.freeze({defaults,normalize,classify});
  if(typeof module!=="undefined")module.exports=a;
  else root.StudyLabGuardianRules=a;
})(globalThis);
