/* Static, privacy-preserving search index. Built from public HTML at Netlify deploy. */
import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const excluded=new Set(["study-room-mini.html"]);
const primary={
 "index.html":["StudyLab Home","Home","Home"],
 "maths.html":["Combined Mathematics","Combined Maths","Subject"],
 "physics.html":["Physics","Physics","Subject"],
 "chemistry.html":["Chemistry","Chemistry","Subject"],
 "biology.html":["Biology","Biology","Subject"],
 "exam-hub.html":["A/L Exam Hub & Past Papers","Past Papers","Exam Hub"],
 "study-tools.html":["Study Tools","Study Utilities","Study Tools"],
 "lesson-packs.html":["Free Lessons & Lesson Packs","Lessons","Lessons"],
 "smk-physics-lessons.html":["SMK Physics Revision Pack","Physics","Lessons"],
 "Audio_Books.html":["Chemistry Audio Books","Chemistry","Audio Books"],
 "Telegram_Channels.html":["Telegram Channels","Resources","Community"],
 "generalenglish.html":["General English Past Papers","General English","Past Papers"],
 "generalknowledge.html":["General Knowledge Past Papers","General Knowledge","Past Papers"],
 "git.html":["GIT Past Papers","GIT","Past Papers"],
 "study-room.html":["Live Study Room","Study Room","Study Room"]
};
function decode(s){
 return String(s||"").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash);/gi,(_,e)=>{
  const names={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",ndash:"-",mdash:"-"};
  if(!e.startsWith("#"))return names[e.toLowerCase()]||" ";
  const n=e[1]?.toLowerCase()==="x"?parseInt(e.slice(2),16):Number(e.slice(1));
  return Number.isInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):" ";
 });
}
function textOnly(s){return decode(String(s||"").replace(/<(script|style|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();}
function attr(s,key){
 const m=String(s||"").match(new RegExp("\\b"+key+"\\s*=\\s*([\"'])(.*?)\\1","i"));
 return m?decode(m[2]):"";
}
function label(s){return String(s).replace(/\.html$/i,"").replace(/\s*\(\d+\)\s*$/,"").replace(/[_-]+/g," ").replace(/([a-z])([A-Z])/g,"$1 $2").trim();}
function encode(p){return p.split("/").map(encodeURIComponent).join("/");}
async function list(d){
 let result=[];
 for(const entry of await readdir(d,{withFileTypes:true})){
  if([".git","node_modules",".netlify"].includes(entry.name))continue;
  const p=path.join(d,entry.name);
  if(entry.isDirectory())result.push(...await list(p));
  else if(entry.isFile()&&/\.html$/i.test(entry.name))result.push(p);
 }
 return result;
}
const collected=(await list(root)).map(p=>path.relative(root,p).split(path.sep).join("/")).filter(p=>!excluded.has(p)).sort();
const byUrl=new Map();
function add(x){
 if(!x.url||!x.title)return;
 const safe={
  url:x.url,
  title:textOnly(x.title).slice(0,135),
  category:x.category,
  subject:x.subject,
  description:textOnly(x.description).slice(0,160),
  keywords:textOnly(x.keywords).slice(0,350)
 };
 if(safe.title&&!byUrl.has(safe.url))byUrl.set(safe.url,safe);
}
for(const relative of collected){
 const html=await readFile(path.join(root,relative),"utf8");
 const title=textOnly(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
 const bits=relative.split("/");
 const dir=bits[1]?.toLowerCase()||"";
 const subject={maths:"Combined Maths",physics:"Physics",chemistry:"Chemistry",biology:"Biology",audios:"Chemistry"}[dir]||"StudyLab";
 const filename=label(bits.at(-1));
 const detected=/past.paper|marking/i.test(filename+" "+title)?"Past Papers":dir==="audios"?"Audio Lesson":"Simulation";
 const page=primary[relative]||[title.length>5&&title.length<105?title:filename,subject,detected];
 const headings=[...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].slice(0,6).map(m=>textOnly(m[1])).join(" ");
 const meta=html.match(/<meta\b([^>]*\bname=["']description["'][^>]*)>/i)?.[1]||"";
 const desc=attr(meta,"content")||textOnly(html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
 add({title:page[0],subject:page[1],category:page[2],url:relative==="index.html"?"/":"/"+encode(relative),
  description:desc,keywords:[filename,title,page[1],headings,relative].join(" ")});

 if(["exam-hub.html","lesson-packs.html","smk-physics-lessons.html"].includes(relative)){
  for(const a of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
   const href=attr(a[1],"href").trim();
   if(!/^https:\/\//i.test(href)&&!/^[/\w.%-]/.test(href))continue;
   if(/^(?:javascript:|\/\/)/i.test(href))continue;
   const h=textOnly(a[2].match(/<(?:h[2-4]|strong)\b[^>]*>([\s\S]*?)<\/(?:h[2-4]|strong)>/i)?.[1]);
   const name=h||attr(a[1],"aria-label");
   if(name.length<7||name.length>115||/^(?:back|open)\b/i.test(name))continue;
   if(!/(?:examhub-card|resource-link|publisher-card)/i.test(a[1]+a[2]))continue;
   const url=/^https:\/\//i.test(href)?href:href.startsWith("/")?href:"/"+href;
   add({title:name,category:relative==="exam-hub.html"?"Past Papers":"Lesson",
    subject:relative==="exam-hub.html"?"Exam Hub":"Lessons",url,
    description:"Linked from "+page[0],keywords:textOnly(a[2])});
  }
 }
 if(["generalenglish.html","generalknowledge.html","git.html"].includes(relative)){
  for(const m of html.matchAll(/<div\b[^>]*class=["'][^"']*paper-item[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi)){
   const item=m[1];
   const title=textOnly(item.match(/class=["'][^"']*paper-title[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]);
   const href=attr(item.match(/<a\b([^>]*)>/i)?.[1],"href");
   if(title&&/^https:\/\//i.test(href))add({title,subject:page[1],category:"Past Papers",url:href,description:"StudyLab past papers",keywords:title});
  }
 }
}
const resources=[...byUrl.values()].sort((a,b)=>a.title.localeCompare(b.title,"en"));
const destination=path.join(root,"assets/data/studylab-search-index.json");
await mkdir(path.dirname(destination),{recursive:true});
await writeFile(destination,JSON.stringify({version:1,count:resources.length,resources},null,2)+"\n","utf8");
console.log("StudyLab search indexed "+resources.length+" resources from "+collected.length+" public pages.");
