const assert=require("node:assert/strict");
const {normalize,core,planned,eligible,demoAllowed,appearance,filterSponsored,validFrame,covers,frames,details,plans,hasPremiumDraft}=require("../assets/js/studylab-plus.js");
assert.equal(normalize(null).active,false);assert.equal(normalize({enabled:false,active:true}).active,false);
assert.equal(normalize({enabled:true,active:true,billing_ready:true}).billing_ready,false);
assert.equal(normalize({enabled:true,active:true}).active,true);
assert.ok(core.some(x=>x.includes("Existing profile pictures")));assert.ok(!planned.includes("Ad-free experience"));assert.ok(planned.includes("Custom studying cards and chat bubbles"));
console.log("PASS: Plus defaults fail closed, billing disabled, existing free features retained in comparison.");

assert.equal(eligible(null),false);assert.equal(eligible({id:"guest",is_anonymous:true}),false);assert.equal(eligible({id:"student",is_anonymous:false}),true);
assert.equal(demoAllowed("deploy-preview-119--studylablk.netlify.app"),true);assert.equal(demoAllowed("studylablk.netlify.app"),false);assert.equal(demoAllowed("deploy-preview-119--studylablk.netlify.app.example.com"),false);
console.log("PASS: registered account eligibility and preview-only demo host.");

assert.equal(demoAllowed("localhost"),true);
assert.deepEqual(appearance({active:false,cover:"aurora",frame:"gold"}),{active:false,cover:"default",frame:"default",effect:"default",bubble:"default",pet:"default",timer:"standard",details:details(null),pattern:"default",cardPattern:"default",cardGlow:"default",chatFont:"default"});
assert.deepEqual(appearance({active:true,cover:"aurora",frame:"gold"}),{active:true,cover:"aurora",frame:"gold",effect:"default",bubble:"default",pet:"default",timer:"standard",details:details(null),pattern:"default",cardPattern:"default",cardGlow:"default",chatFont:"default"});
assert.deepEqual(appearance({active:true,cover:"url(unsafe)",frame:"invalid"}),{active:true,cover:"default",frame:"default",effect:"default",bubble:"default",pet:"default",timer:"standard",details:details(null),pattern:"default",cardPattern:"default",cardGlow:"default",chatFont:"default"});
const banners=[{kind:"announcement"},{kind:"sponsored"},{kind:"announcement",design:{preset:"sponsored"}},{kind:"feature"},{kind:"resource"}];
assert.equal(filterSponsored(banners,false).length,5);
assert.deepEqual(filterSponsored(banners,true),banners);
const fs=require("node:fs"),path=require("node:path");
const sql=fs.readFileSync(path.join(__dirname,"../supabase/plus-preview/plus_foundation.sql"),"utf8");
assert.match(sql,/studylab_plus_appearance enable row level security/);
assert.match(sql,/revoke all on public\.studylab_plus_appearance from public,anon,authenticated/);
assert.match(sql,/public\.studylab_plus_status\(\)->>'active'/);
assert.match(sql,/not coalesce\(public\.studylab_social_is_admin\(\),false\)/);
const profile=fs.readFileSync(path.join(__dirname,"../assets/js/studylab-profile-view.js"),"utf8");
assert.match(profile,/view\.hidden=false;\s*if\(own&&plusEntry\)void window\.StudyLabPlus\?\.sync/);
console.log("PASS: preset validation, sponsor filtering, SQL guards and profile opening sequence.");

assert.equal(covers.length,12);assert.equal(frames.length,8);
assert.equal(validFrame("#00aAFF"),true);assert.equal(validFrame("url(javascript:bad)"),false);
assert.equal(appearance({active:true,cover:"galaxy",frame:"#00AAFF"}).frame,"#00AAFF");
assert.equal(appearance({active:false,cover:"galaxy",frame:"#00AAFF"}).cover,"default");
assert.doesNotMatch(sql,/\bas \$\n|\bend; \$;/);
assert.match(sql,/studylab_plus_public_styles\(p_users uuid\[\]\)/);
assert.match(sql,/cardinality\(p_users\),0\)>100/);
const plusCode=fs.readFileSync(path.join(__dirname,"../assets/js/studylab-plus.js"),"utf8");
const plusCss=fs.readFileSync(path.join(__dirname,"../assets/css/studylab-plus.css"),"utf8");
assert.match(plusCode,/sl-plus-plans/);
assert.match(plusCode,/picker.type="color"/);
assert.match(plusCss,/prefers-reduced-motion:reduce/);
const telegramCode=fs.readFileSync(path.join(__dirname,"../assets/js/telegram-channel-browser.js"),"utf8");
assert.doesNotMatch(telegramCode,/plusAdFree/);
console.log("PASS: cover and ring catalog, custom color validation, staged SQL delimiters, responsive motion and sponsored controls.");

assert.equal(appearance({active:true,effect:"galaxy",bubble:"mint",pet:"nebula",timer:"micro"}).timer,"micro");
assert.equal(appearance({active:false,effect:"galaxy",bubble:"mint",pet:"nebula",timer:"micro"}).effect,"default");
assert.equal(appearance({active:true,bubble:"unsafe"}).bubble,"default");
assert.equal((sql.match(/create table public\.studylab_plus_appearance/g)||[]).length,1);
const room=fs.readFileSync(path.join(__dirname,"../assets/js/study-room-realtime.js"),"utf8");
assert.match(room,/room-rank-subject/);assert.doesNotMatch(room,/querySelector\('\.room-rank-info span'\)/);

assert.equal(hasPremiumDraft({}),false);
assert.equal(hasPremiumDraft({cover:"galaxy"}),true);
assert.equal(hasPremiumDraft({details:{shape:"orb"}}),true);
assert.equal(hasPremiumDraft({details:{eyeColor:"url(unsafe)"}}),false);
assert.deepEqual(plans.map(p=>[p.months,p.price]),[[1,199],[3,499],[12,1799]]);
assert.equal(details({eyeColor:"#ABCDEF",timerAccent:"red",shape:"orb",eyes:"star",glow:"neon",mouth:"smile"}).eyeColor,"#abcdef");
assert.equal(details({timerAccent:"red"}).timerAccent,"default");
assert.deepEqual(appearance({active:false,details:{shape:"orb",eyes:"star"}}).details,details(null));
assert.match(plusCode,/if\(!latest.active\)\{/);
assert.match(plusCode,/p_details:next.details/);
assert.match(sql,/p_details jsonb/);
assert.match(sql,/details jsonb not null/);
assert.match(sql,/coalesce\(details->>'eyeColor'/);
assert.match(room,/sl-plus-name-text/);
assert.match(plusCss,/\.room-person-card\[data-plus-effect\]/);
const pet=fs.readFileSync(path.join(__dirname,"../assets/js/studylab-pet.js"),"utf8");
const roomPet=fs.readFileSync(path.join(__dirname,"../assets/js/studylab-pet-room.js"),"utf8");
for(const code of [pet,roomPet]){assert.match(code,/plus.openStudio\("pet"\)/);assert.match(code,/plus.paintPet\(character,state\)/);}
console.log("PASS: Studio draft entitlement, pricing, pet details, shared cosmetic validation and integration paths.");

assert.equal(details({timerAccent:"#abcdef"}).timerAccent,"default");
assert.equal(appearance({active:true,pattern:"science",cardPattern:"books",cardGlow:"halo",chatFont:"mono"}).cardPattern,"books");
assert.equal(appearance({active:false,pattern:"science",cardGlow:"halo",chatFont:"mono"}).chatFont,"default");
assert.equal(appearance({active:true,pattern:"invalid",cardGlow:"invalid",chatFont:"invalid"}).pattern,"default");
assert.match(plusCode,/layout.append\(controls,previewPane\)/);assert.match(plusCode,/attachMenu/);assert.match(plusCode,/paintMotifs/);assert.match(plusCode,/p_chat_font:next.chatFont/);
assert.doesNotMatch(plusCode,/if\(category==="timer"\)/);assert.match(plusCode,/StudyLabAvatar\?\.decorate\(sampleAvatar,user.id\)/);
console.log("PASS: polished Studio controls, public appearance normalization and theme-controlled timer.");

assert.equal(appearance({active:true,chatFont:"italic"}).chatFont,"italic");
assert.equal(appearance({active:true,chatFont:"rog"}).chatFont,"rog");
assert.equal(details({eyes:"droplet"}).eyes,"droplet");
assert.equal(details({eyes:"focused"}).eyes,"focused");
assert.equal(details({eyes:"sleepy"}).eyes,"sleepy");
assert.match(plusCss,/data-plus-chat-font=italic/);assert.match(plusCss,/data-plus-chat-font=rog/);
assert.match(plusCss,/\.room-person-card>\.sl-plus-floats\{z-index:0/);
assert.match(plusCode,/Chat bubble colours and 5 extra message fonts/);
assert.match(plusCode,/Planned, not yet available/);
console.log("PASS: expanded eye and font catalogs, card watermark stacking and plan feature disclosure.");

assert.equal(details({workspace:"aurora"}).workspace,"aurora");assert.equal(details({workspace:"invalid"}).workspace,"default");
assert.match(sql,/studylab_plus_admin_billing_summary/);assert.match(sql,/primary key\(environment,provider_payment_id\)/);assert.match(sql,/studylab_plus_billing_payments enable row level security/);
assert.match(plusCode,/Premium Home and Study Room backgrounds/);assert.match(plusCode,/Advanced personal study reports/);
console.log("PASS: private backgrounds, explicit plan benefits, payment ledger isolation and admin reporting guard.");
