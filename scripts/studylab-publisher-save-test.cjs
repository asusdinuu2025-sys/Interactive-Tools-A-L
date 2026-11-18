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
  assert.equal(saved[1].item.html_name,"pendulum.html",
    "The original filename remains visible on subsequent edits");

  // New Telegram channel: published under the chosen category.
  d=open("telegram",true);
  d.querySelector('[name="title"]').value="Chemistry Channel";
  d.querySelector('[name="link"]').value="https://t.me/chemistry2028";
  assert.equal(d.querySelector('[name="order"]'),null,
    "Telegram publisher must assign order automatically without an extra field");
  assert.match(d.textContent,/Newest channels appear first automatically/);
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

  // PR112: No group image means the original Telegram icon, not an emoji.
  assert.equal(saved[2].item.image,"");
  assert.equal(saved[2].item.avatar_file_path,"");

  // Add a group picture to the existing sponsored channel via existing media API.
  publisher.open("telegram","sponsored",{
    id:saved[2].item.id,draft:saved[2].item,revision:1,published:true
  });
  d=findDialog();
  assert.ok(d.querySelector('[name="telegram_avatar"]'),"Telegram editor offers a group photo");
  assert.equal(d.querySelector('[name="emoji"]'),null,
    "Telegram editor should no longer tempt admins to replace the default icon with emoji");
  assert.match(d.textContent,/Original Telegram icon/);
  setFile(d.querySelector('[name="telegram_avatar"]'),
    new w.File(["JPG"],"chemistry-dp.jpg",{type:"image/jpeg"}));
  await clickPublish(d);
  const pictured=saved[4].item;
  assert.equal(pictured.telegram_category,"sponsored");
  assert.equal(pictured.avatar_file_name,"chemistry-dp.jpg");
  assert.equal(pictured.avatar_file_path,"uploads/3.png");
  assert.equal(pictured.image,"https://example.org/uploads/3.png");
  assert.equal(deletedMedia.length,0);

  // Editing details without a new file must retain the current picture.
  publisher.open("telegram","sponsored",{
    id:pictured.id,draft:pictured,revision:2,published:true
  });
  d=findDialog();
  assert.ok(d.querySelector(".sladmin-publish-avatar-thumbnail"));
  await clickPublish(d);
  assert.equal(saved[5].item.avatar_file_path,"uploads/3.png");
  assert.equal(uploadedMedia.length,3);

  // Replacement removes only the previous file after successfully saving.
  publisher.open("telegram","sponsored",{
    id:pictured.id,draft:saved[5].item,revision:3,published:true
  });
  d=findDialog();
  setFile(d.querySelector('[name="telegram_avatar"]'),
    new w.File(["PNG"],"new-dp.png",{type:"image/png"}));
  await clickPublish(d);
  assert.equal(saved[6].item.avatar_file_path,"uploads/4.png");
  assert.deepEqual(deletedMedia,["uploads/3.png"]);

  // Removing the profile image restores the default Telegram logo on the
  // public card without removing the rest of the channel details.
  publisher.open("telegram","sponsored",{
    id:pictured.id,draft:saved[6].item,revision:4,published:true
  });
  d=findDialog();
  const remove=d.querySelector('[name="remove_telegram_avatar"]');
  assert.ok(remove,"Existing Telegram image must be removable");
  remove.checked=true;
  await clickPublish(d);
  assert.equal(saved[7].item.image,"");
  assert.equal(saved[7].item.avatar_file_path,"");
  assert.equal(saved[7].item.title,"Chemistry Channel");
  assert.deepEqual(deletedMedia,["uploads/3.png","uploads/4.png"]);

  // A failed database save must clean up ONLY the fresh upload, retaining
  // any previously saved photo. Never claim success after a failed RPC.
  const previousSave=api.save;
  api.save=async()=>{throw Error("Test write rejected")};
  publisher.open("telegram","sponsored",{
    id:pictured.id,draft:saved[6].item,revision:4,published:true
  });
  d=findDialog();
  setFile(d.querySelector('[name="telegram_avatar"]'),
    new w.File(["PNG"],"rejected.png",{type:"image/png"}));
  await clickPublish(d);
  assert.match(d.querySelector("[data-publisher-status]").textContent,/Test write rejected/);
  assert.ok(deletedMedia.includes("uploads/5.png"));
  api.save=previousSave;
  d.close();

  // PDF is not a Telegram profile image.
  publisher.open("telegram","sponsored",{
    id:pictured.id,draft:saved[7].item,revision:5,published:true
  });
  d=findDialog();
  setFile(d.querySelector('[name="telegram_avatar"]'),
    new w.File(["%PDF-1.7"],"bad.pdf",{type:"application/pdf"}));
  await clickPublish(d);
  assert.match(d.querySelector("[data-publisher-status]").textContent,/JPG, PNG or WebP/);
  assert.equal(uploadedMedia.length,5);
  d.close();

  // New Telegram card auto-orders after existing entries across categories.
  // Editing it must not move it to the front or change its saved position.
  const seeded=[{id:"old-sponsor",draft:{page:"Telegram_Channels.html",
    kind:"card",resource_type:"telegram",telegram_category:"sponsored",order:280}},
    {id:"old-maths",draft:{page:"Telegram_Channels.html",
      kind:"card",resource_type:"telegram",telegram_category:"maths",order:300}}];
  const seededHost=w.document.createElement("main");
  w.document.body.append(seededHost);
  const publisher2=w.StudyLabAdminPublisher.mount(seededHost,api,seeded,async()=>{});
  const previousCount=saved.length;
  publisher2.open("telegram","biology");
  d=findDialog();
  d.querySelector('[name="title"]').value="Newest BIO";
  d.querySelector('[name="link"]').value="https://t.me/newbio";
  assert.equal(d.querySelector('[name="order"]'),null);
  await clickPublish(d);
  assert.equal(saved[previousCount].item.order,310,
    "Newly published channels get next order number across categories");
  const newer=saved[previousCount].item;
  publisher2.open("telegram","biology",{
    id:newer.id,draft:newer,revision:1,published:true
  });
  d=findDialog();
  await clickPublish(d);
  assert.equal(saved[previousCount+1].item.order,310,
    "Editing an existing channel retains its original newest-first position");

  dom.window.close();
  console.log("PASS: automatic Telegram publishing order, avatar upload/edit/rollback, HTML and PDF publishing.");
})().catch(err=>{console.error(err);process.exitCode=1});
