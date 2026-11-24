const assert=require("node:assert/strict");
const {normalize,core,planned,eligible,demoAllowed}=require("../assets/js/studylab-plus.js");
assert.equal(normalize(null).active,false);assert.equal(normalize({enabled:false,active:true}).active,false);
assert.equal(normalize({enabled:true,active:true,billing_ready:true}).billing_ready,false);
assert.equal(normalize({enabled:true,active:true}).active,true);
assert.ok(core.some(x=>x.includes("Existing profile pictures")));assert.ok(planned.includes("Ad-free experience"));
console.log("PASS: Plus defaults fail closed, billing disabled, existing free features retained in comparison.");

assert.equal(eligible(null),false);assert.equal(eligible({id:"guest",is_anonymous:true}),false);assert.equal(eligible({id:"student",is_anonymous:false}),true);
assert.equal(demoAllowed("deploy-preview-119--studylablk.netlify.app"),true);assert.equal(demoAllowed("studylablk.netlify.app"),false);assert.equal(demoAllowed("deploy-preview-119--studylablk.netlify.app.example.com"),false);
console.log("PASS: registered account eligibility and preview-only demo host.");
