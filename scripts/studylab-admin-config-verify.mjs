import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";

const script=resolve("scripts/generate-admin-config.mjs");
const baseline=readFileSync("assets/js/studylab-admin-config.js","utf8");
function runAt(code,hostname) {
  const window={location:{hostname}};
  runInNewContext(code,{window});
  return window.StudyLabAdminConfig;
}
const hosts=[
  ["studylablk.netlify.app","live",null],
  ["deploy-preview-114--studylablk.netlify.app","connected","114"],
  ["deploy-preview-115--studylablk.netlify.app","connected","115"],
  ["deploy-preview-102--studylablk.netlify.app","connected","102"],
  ["deploy-preview-110--studylablk.netlify.app","connected","110"],
  ["deploy-preview-116--studylablk.netlify.app","preview","116"],
  ["branch--studylablk.netlify.app","preview",null],
  ["studylablk.netlify.app.evil.example","preview",null],
  ["example.org","preview",null],
  ["localhost","preview",null]
];
for (const [host,mode,reviewId] of hosts){
  const result=runAt(baseline,host);
  assert.equal(result.mode,mode,host+" must use "+mode+" Admin mode");
  assert.equal(result.reviewId,reviewId,host+" review ID");
  assert(Object.isFrozen(result),"Admin runtime config is immutable");
}
for (const [context,review] of [
  ["production",""],["deploy-preview","115"],["deploy-preview","116"],
  ["branch-deploy","115"],["",""]
]){
  const root=mkdtempSync(join(tmpdir(),"studylab-admin-config-"));
  mkdirSync(join(root,"assets","js"),{recursive:true});
  try{
    const generated=spawnSync(process.execPath,[script],{
      cwd:root,encoding:"utf8",
      env:{...process.env,CONTEXT:context,REVIEW_ID:review}
    });
    assert.equal(generated.status,0,generated.stderr||generated.stdout);
    const code=readFileSync(join(root,"assets/js/studylab-admin-config.js"),"utf8");
    assert.equal(code,baseline,
      "Build context must never turn the trusted production origin into a local preview");
    for (const [host,mode,reviewId] of hosts) {
      const result=runAt(code,host);
      assert.equal(result.mode,mode,context+": "+host);
      assert.equal(result.reviewId,reviewId);
    }
  }finally{rmSync(root,{recursive:true,force:true});}
}
console.log("PASS: live production, approved PR previews, and isolated unapproved hosts are enforced independently of build context.");
