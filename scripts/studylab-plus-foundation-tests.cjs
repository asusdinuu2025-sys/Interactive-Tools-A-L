const assert=require("node:assert/strict");
const {normalize,core,planned}=require("../assets/js/studylab-plus.js");
assert.equal(normalize(null).active,false);assert.equal(normalize({enabled:false,active:true}).active,false);
assert.equal(normalize({enabled:true,active:true,billing_ready:true}).billing_ready,false);
assert.equal(normalize({enabled:true,active:true}).active,true);
assert.ok(core.some(x=>x.includes("Existing profile pictures")));assert.ok(planned.includes("Ad-free experience"));
console.log("PASS: Plus defaults fail closed, billing disabled, existing free features retained in comparison.");
