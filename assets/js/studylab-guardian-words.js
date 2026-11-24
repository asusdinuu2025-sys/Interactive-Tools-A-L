(function(root){
"use strict";
const normalize=text=>String(text??"").normalize("NFC").replace(/[A-Z]/g,c=>c.toLowerCase()).replace(/[^a-z0-9\u0D80-\u0DFF]+/g," ").trim();
function parse(raw){
 const lines=String(raw??"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(lines.length>200)throw Error("Maximum 200 entries.");
 const words=[];
 for(const line of lines){const t=normalize(line);if(!t||t.length>80||line.length>120)throw Error("Use 1–80 normalized characters per word or phrase.");if(!words.includes(t))words.push(t);}
 return words;
}
const matches=(text,words)=>{const body=" "+normalize(text)+" ";return words.some(w=>{const t=normalize(w);return t&&body.includes(" "+t+" ");});};
const api=Object.freeze({normalize,parse,matches});
if(typeof module!=="undefined")module.exports=api;else root.StudyLabGuardianWords=api;
})(globalThis);
