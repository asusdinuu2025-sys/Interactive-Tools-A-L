const assert=require("node:assert/strict");
const {normalize,core,planned,eligible,demoAllowed,appearance,filterSponsored}=require("../assets/js/studylab-plus.js");
assert.equal(normalize(null).active,false);assert.equal(normalize({enabled:false,active:true}).active,false);
assert.equal(normalize({enabled:true,active:true,billing_ready:true}).billing_ready,false);
assert.equal(normalize({enabled:true,active:true}).active,true);
assert.ok(core.some(x=>x.includes("Existing profile pictures")));assert.ok(planned.includes("Ad-free experience"));
console.log("PASS: Plus defaults fail closed, billing disabled, existing free features retained in comparison.");

assert.equal(eligible(null),false);assert.equal(eligible({id:"guest",is_anonymous:true}),false);assert.equal(eligible({id:"student",is_anonymous:false}),true);
assert.equal(demoAllowed("deploy-preview-119--studylablk.netlify.app"),true);assert.equal(demoAllowed("studylablk.netlify.app"),false);assert.equal(demoAllowed("deploy-preview-119--studylablk.netlify.app.example.com"),false);
console.log("PASS: registered account eligibility and preview-only demo host.");

assert.equal(demoAllowed("localhost"),true);
assert.deepEqual(appearance({active:false,cover:"aurora",frame:"gold"}),{active:false,cover:"default",frame:"default"});
assert.deepEqual(appearance({active:true,cover:"aurora",frame:"gold"}),{active:true,cover:"aurora",frame:"gold"});
assert.deepEqual(appearance({active:true,cover:"url(unsafe)",frame:"invalid"}),{active:true,cover:"default",frame:"default"});
const banners=[{kind:"announcement"},{kind:"sponsored"},{kind:"announcement",design:{preset:"sponsored"}},{kind:"feature"},{kind:"resource"}];
assert.equal(filterSponsored(banners,false).length,5);
assert.deepEqual(filterSponsored(banners,true),[banners[0],banners[3],banners[4]]);
const fs=require("node:fs"),path=require("node:path");
const sql=fs.readFileSync(path.join(__dirname,"../supabase/plus-preview/plus_foundation.sql"),"utf8");
assert.match(sql,/studylab_plus_appearance enable row level security/);
assert.match(sql,/revoke all on public\.studylab_plus_appearance from public,anon,authenticated/);
assert.match(sql,/public\.studylab_plus_status\(\)->>'active'/);
assert.match(sql,/not coalesce\(public\.studylab_social_is_admin\(\),false\)/);
const profile=fs.readFileSync(path.join(__dirname,"../assets/js/studylab-profile-view.js"),"utf8");
assert.match(profile,/view\.hidden=false;\s*if\(own&&plusEntry\)void window\.StudyLabPlus\?\.sync/);
console.log("PASS: preset validation, sponsor filtering, SQL guards and profile opening sequence.");
