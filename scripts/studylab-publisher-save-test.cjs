/* PR102 guided publisher end-to-end save/edit regression, no network or live writes. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const markup="<!doctype html><html><body><main id='host'></main></body></html>";
const dom=new JSDOM(markup,{
  url:"https://deploy-preview-102--studylablk.netlify.app/admin.html",
  runScripts:"outside-only",pretendToBeVisual:true
});
const w=dom.window;
w.confirm=()=>true;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){
  this.open=false;this.dispatchEvent(new w.Event("close"));
};
let uuid=0;
w.crypto.randomUUID=()=>String(++uuid).padStart(8,"0")+"-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const saved=[],uploadedHTML=[],uploadedMedia=[],deletedHTML=[],deletedMedia=[],reads=[];
const api={
  preview:false,
  uploadSimulation:async file=>{
    uploadedHTML.push(file.name);
    return {path:"html/aaaaaaaa-aaaa-4aaa-8aaa-"+String(uploadedHTML.length).padStart(12,"0")+".html"};
  },
  readSimulation:async path=>{reads.push(path);return "<html><body>Existing simulation</body></html>";},
  removeSimulation:async path=>{deletedHTML.push(path);},
  upload:async file=>{
    const path="uploads/"+String(uploadedMedia.length+1)+
      (file.type==="application/pdf"?".pdf":".png");
    uploadedMedia.push({path,file});
    return {path,url:"https://example.org/"+path};
  },
  removeMedia:async path=>{deletedMedia.push(path);},
  save:async (item,revision,action)=>{
    saved.push({item:{...item},revision,action});
    return {draft:item,revision:revision+1,published:action==="publish"};
  }
};
w.eval(fs.readFileSync("assets/js/studylab-admin-publisher.js","utf8"));
const publisher=w.StudyLabAdminPublisher.mount(
  w.document.getElementById("host"),api,[],async()=>{}
);
const findDialog=()=>w.document.querySelector(".sladmin-publish-dialog");
const open=(kind,path)=>{
  w.document.querySelector('[data-kind="'+kind+'"]').click();
  if(path)w.document.querySelector(".sladmin-path-choice").click();
  return findDialog();
};
const setFile=(input,file)=>{
  Object.defineProperty(input,"files",{configurable:true,value:[file]});
  input.required=false;
};
const clickPublish=async dialog=>{
  dialog.querySelector(".sladmin-primary").click();
  await wait(80);
};
(async()=>{
  // New HTML simulation: file must upload once, and its ID must persist.
  let d=open("simulation",true);
  assert.ok(d,"Simulation publisher opens");
  d.querySelector('[name="title"]').value="Pendulum simulation";
  const html=new w.File(["<!doctype html><title>Pendulum</title>"],"pendulum.html",{type:"text/html"});
  setFile(d.querySelector('[name="html"]'),html);
  await clickPublish(d);
  assert.equal(uploadedHTML.length,1,"A new simulation uploads once");
  assert.equal(saved.length,1,"Simulation record is saved");
  assert.match(saved[0].item.html_path,/^html\//);
  assert.equal(saved[0].item.html_name,"pendulum.html");
  const old=saved[0].item;
  assert.equal(deletedHTML.length,0,"Successful uploads cannot be deleted");

  // Existing resource: keep its old file if editor is saved without re-upload.
  publisher.open("simulation","maths.html",{
    id:old.id,draft:old,revision:1,published:true
  });
  d=findDialog();
  assert.match(d.textContent,/Saved HTML: pendulum\.html/);
  assert.equal(d.querySelector('[name="html"]').required,false);
  d.querySelector(".sladmin-editor-actions button").click();
  await wait(50);
  assert.deepEqual(reads,[old.html_path],"Preview reads saved HTML without another upload");
  const preview=w.document.querySelector(".sladmin-html-preview");
  assert.ok(preview,"The existing HTML is previewable in the sandbox");
  preview.close();
  await clickPublish(d);
  assert.equal(uploadedHTML.length,1,"Editing without a replacement must not upload again");
  assert.equal(saved[1].item.html_path,old.html_path,"Stored HTML path stays attached");

  // New Telegram channel: published under the chosen category.
  d=open("telegram",true);
  d.querySelector('[name="title"]').value="Chemistry Channel";
  d.querySelector('[name="link"]').value="https://t.me/chemistry2028";
  await clickPublish(d);
  assert.equal(saved[2].item.resource_type,"telegram");
  assert.equal(saved[2].item.telegram_category,"sponsored");
  assert.equal(saved[2].item.url,"https://t.me/chemistry2028");

  // Lesson pack can be uploaded as PDF with a new cover, no URL required.
  d=open("lesson-pack",true);
  d.querySelector('[name="title"]').value="Maths Lessons";
  setFile(d.querySelector('[name="pack_pdf"]'),
    new w.File(["%PDF-1.7"],"lessons.pdf",{type:"application/pdf"}));
  setFile(d.querySelector('[name="pack_cover"]'),
    new w.File(["img"],"cover.png",{type:"image/png"}));
  await clickPublish(d);
  assert.equal(saved[3].item.resource_type,"lesson-pack");
  assert.equal(saved[3].item.pack_file_name,"lessons.pdf");
  assert.equal(saved[3].item.cover_file_name,"cover.png");
  assert.match(saved[3].item.url,/example\.org\/uploads/);
  assert.equal(uploadedMedia.length,2);
  assert.equal(deletedMedia.length,0);
  assert.equal(deletedHTML.length,0);
  dom.window.close();
  console.log("PASS: HTML upload/edit/preview, Telegram channel, PDF lesson pack and cover publishing.");
})().catch(err=>{console.error(err);process.exitCode=1});
