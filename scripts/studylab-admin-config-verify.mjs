import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const script=resolve("scripts/generate-admin-config.mjs");
function verify(context,review,expected) {
  const root=mkdtempSync(join(tmpdir(),"studylab-admin-config-"));
  mkdirSync(join(root,"assets","js"),{recursive:true});
  try {
    const result=spawnSync(process.execPath,[script],{
      cwd:root,encoding:"utf8",
      env:{...process.env,CONTEXT:context,REVIEW_ID:review,
        STUDYLAB_ADMIN_LIVE:""}
    });
    assert.equal(result.status,0,result.stderr||result.stdout);
    const data=readFileSync(join(root,"assets/js/studylab-admin-config.js"),"utf8");
    assert.match(data,new RegExp('"mode":"'+expected+'"'));
  }finally{rmSync(root,{recursive:true,force:true});}
}
verify("production","","live");
verify("deploy-preview","102","connected");
verify("deploy-preview","104","preview");
verify("branch-deploy","","preview");
console.log("PASS: authorized admin controls enabled only in production and approved PR102.");
