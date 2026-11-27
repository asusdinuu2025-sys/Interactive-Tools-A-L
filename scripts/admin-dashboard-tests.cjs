const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("assert/strict");
const root = process.cwd(),
  read = (p) => fs.readFileSync(p, "utf8"),
  wait = () => new Promise((r) => setTimeout(r, 40));
async function setup(admin = true, options = {}) {
  const dom = new JSDOM(read("admin.html"), {
    url: "https://preview.example/admin.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  if (options.previewData !== undefined) {
    w.localStorage.setItem("studylab-admin-preview-v1", options.previewData);
  }
  if (options.themeMode) w.localStorage.setItem("studylab-room-mode-v1", options.themeMode);
  w.matchMedia = () => ({ matches: options.prefersDark !== false, addEventListener() {} });
  w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  let calls = [];
  w.supabase = {
    createClient: () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "24e78cd0-4565-407a-96f7-9cfde083f6d2",
              created_at: "2026-01-01",
            },
          },
        }),
      },
      rpc: async (name) => {
        calls.push(name);
        if (name === "studylab_admin_readonly_stats_v1")
          return options.liveStats
            ? { data: options.liveStats }
            : { data: null, error: { message: "Live preview RPC not installed in mock" } };
        if (name === "studylab_admin_readonly_users_v1" ||
            name === "studylab_admin_users")
          return { data: options.liveUsers || { rows: [], total: 0 } };
        if (name === "studylab_admin_content_list" ||
            name === "studylab_admin_activity")
          return { data: [] };
        return { data: admin };
      },
      functions: {
        invoke: async (name, opts) => {
          calls.push(name);
          return { data: { ok: true, banned: Number(opts?.body?.hours) !== 0 } };
        },
      },
      from: () => {
        throw Error("Unexpected remote write/read in preview");
      },
    }),
  };
  w.fetch = async () => ({
    ok: true,
    json: async () => JSON.parse(read("assets/data/admin-content-seed.json")),
  });
  for (const f of [
    "studylab-admin-config",
    "studylab-admin-api",
    "studylab-popup-format",
    "studylab-admin",
  ]) {
    w.eval(read("assets/js/" + f + ".js"));
    if (f === "studylab-admin-config" && options.connected)
      w.StudyLabAdminConfig = Object.freeze({ mode: "connected" });
    if (f === "studylab-admin-api" && options.failOverview) {
      w.StudyLabAdminAPI = Object.freeze({
        ...w.StudyLabAdminAPI,
        content: async () => { throw new Error("Test overview request failed"); },
      });
    }
  }
  await wait();
  return { dom, w, calls };
}
(async () => {
  let { dom, w, calls } = await setup();
  assert.equal(w.document.querySelector("#sladmin-workspace").hidden, false);
  assert.equal(w.document.querySelectorAll(".sladmin-stats .sladmin-card").length, 4);
  assert.equal(w.document.querySelectorAll(".sladmin-quick-icon").length,6);
  assert.equal(w.document.querySelector("#sladmin-mode").hidden,false,
    "Preview-only mode must stay visible so admins don't mistake local messages for live publishing");
  assert.match(w.document.querySelector("#sladmin-mode").textContent,/Preview workspace/);
  // Pop-up markdown is rendered as DOM nodes, never unsanitized HTML.
  const rich = w.document.createElement("p");
  w.StudyLabPopupFormat.render(rich,
    "**Bold** and __underlined__, *italic*, ~~deleted~~, `code`. <script>bad()</script>");
  assert.equal(rich.querySelector("strong")?.textContent,"Bold");
  assert.equal(rich.querySelector("u")?.textContent,"underlined");
  assert.equal(rich.querySelector("em")?.textContent,"italic");
  assert.equal(rich.querySelector("s")?.textContent,"deleted");
  assert.equal(rich.querySelector("code")?.textContent,"code");
  assert.equal(rich.querySelectorAll("script,img").length,0);
  assert.match(rich.textContent,/<script>bad\(\)<\/script>/);
  // Hover pauses the actual dismiss timer, rather than only its progress bar.
  const timed = w.document.createElement("aside");
  w.document.body.append(timed);
  let dismissed = false;
  const stop = w.StudyLabPopupFormat.armTimer(timed,70,()=>{dismissed=true;});
  timed.dispatchEvent(new w.Event("pointerenter"));
  await new Promise(resolve => setTimeout(resolve,95));
  assert.equal(dismissed,false,"Hover must prevent the pop-up from closing");
  assert.ok(timed.classList.contains("slpopup-paused"));
  timed.dispatchEvent(new w.Event("pointerleave"));
  await new Promise(resolve => setTimeout(resolve,100));
  assert.equal(dismissed,true,"Countdown should resume with remaining time");
  stop();
  timed.remove();
  // Simulate a generic cosmetic ad-block rule. The Admin Dashboard should
  // not have ad-looking IDs or classes, and must remain visible.
  const cosmetic = w.document.createElement("style");
  cosmetic.textContent = '[id^="ad-"], [class^="ad-"], [class*=" ad-"] { display: none !important; }';
  w.document.head.appendChild(cosmetic);
  assert.equal(w.document.querySelectorAll('[id^="ad-"], [class^="ad-"], [class*=" ad-"]').length, 0);
  assert.notEqual(w.getComputedStyle(w.document.querySelector("#sladmin-content")).display, "none");
  assert.notEqual(w.getComputedStyle(w.document.querySelector("#sladmin-tabs")).display, "none");
  assert.equal(w.document.querySelectorAll(".sladmin-stats .sladmin-card").length, 4);
  const click = (text) =>
    [...w.document.querySelectorAll("button")]
      .find((b) => b.textContent === text)
      .click();
  click("Content");
  await wait();
  assert.ok(w.document.querySelectorAll(".sladmin-row").length > 100);
  click("+ New card");
  await wait();
  const f = w.document.querySelector("#sladmin-form");
  f.elements.title.value = "Safe <script>title</script>";
  f.elements.url.value = "https://example.org/resource";
  f.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert.match(
    w.document.querySelector("#sladmin-save-state").textContent,
    /Unsaved/,
  );
  f.dispatchEvent(
    new w.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter: [...f.querySelectorAll("button")].find(
        (b) => b.value === "publish",
      ),
    }),
  );
  await wait();
  let state = JSON.parse(w.localStorage.getItem("studylab-admin-preview-v1"));
  assert.equal(state.published.length, 1);
  assert.equal(state.published[0].title, "Safe <script>title</script>");
  assert.equal(w.document.querySelectorAll(".sladmin-row script").length, 0);
  click("Sections");
  await wait();
  click("+ New section");
  await wait();
  const sectionEditor=w.document.querySelector("#sladmin-form");
  assert.ok(sectionEditor.elements.kicker,"Custom sections need a small-heading field");
  assert.ok(sectionEditor.elements.layout,"Sections must retain the grid/list toggle");
  assert.equal(sectionEditor.elements.page,undefined,
    "New sections always belong to Home; no redundant Page dropdown");
  assert.deepEqual([...sectionEditor.elements.layout.options].map(o=>o.value),["cards","list"]);
  w.document.querySelector("#sladmin-editor").close();
  click("Content");
  await wait();
  assert.equal(w.document.querySelector("#sladmin-mode").hidden,false,
    "Preview status remains visible after editing or publishing local drafts");
  click("Pop-up Messages");
  await wait();
  click("+ New pop-up");
  const popupForm = w.document.querySelector(".sladmin-popup-dialog form");
  assert.ok(popupForm, "New popup editor is present");
  popupForm.querySelector('[name="title"]').value="Hello";
  popupForm.querySelector('[name="message"]').value="**Welcome** __student__";
  popupForm.querySelector('button').disabled = false;
  [...popupForm.querySelectorAll("button")].find(b=>b.textContent==="Preview").click();
  assert.equal(w.document.querySelector(".slpopup-toast .slpopup-message strong")?.textContent,"Welcome");
  assert.equal(w.document.querySelector(".slpopup-toast .slpopup-message u")?.textContent,"student");
  w.document.querySelector(".slpopup-toast .slpopup-close").click();
  assert.equal(popupForm.querySelector('[name="link_label"]').value,"View");
  assert.equal(popupForm.querySelector('[name="link_label"]').maxLength,20);
  const expirySelect=popupForm.querySelector('[name="expiry_period"]');
  assert.ok(expirySelect,"Admin popup must have an expiry selector");
  assert.deepEqual([...expirySelect.options].map(x=>x.value),
    ["24h","7d","1m","3m","6m","9m","1y"]);
  assert.equal(expirySelect.value,"24h","Existing messages preserve 24-hour default");
  expirySelect.value="6m";
  assert.equal(expirySelect.value,"6m");
  popupForm.querySelector('button[aria-label="Close pop-up editor"]').click();
  click("Admins");
  await wait();
  assert.equal([...w.document.querySelectorAll(".sladmin-row-actions button")]
    .filter(b=>/^(?:Ban|Unban) user$/i.test(b.textContent)).length,0,
    "The Admins tab must not offer Ban buttons");
  click("Users");
  await wait();
  assert.equal(w.document.querySelectorAll(".sladmin-row").length, 5);
  assert.ok([...w.document.querySelectorAll(".sladmin-row-actions button")]
    .some(b=>/^Ban user$/i.test(b.textContent)),
    "User moderation remains accessible in the Users tab");
  click("Give blue badge");
  await wait();
  assert.ok(
    JSON.parse(w.localStorage.getItem("studylab-admin-preview-v1")).activity
      .length >= 2,
  );
  assert.equal(calls[0],"studylab_social_is_admin");
  assert(calls.includes("studylab_admin_readonly_stats_v1"));
  assert(calls.includes("studylab_admin_activity"),
    "Authorized previews must fetch live audit history read-only");
  const api = w.StudyLabAdminAPI;
  const normalized = api.validate({
    ...state.published[0], url:"studylablk.netlify.app", button_label:"Try"
  });
  assert.equal(normalized.url,"https://studylablk.netlify.app");
  assert.equal(normalized.button_label,"Try");
  const sampleSection={id:"custom-section-new",kind:"section",title:"Example",page:"index.html",
    order:100,description:"Example section",image:"",hidden:false,kicker:"STUDY TOOLS",layout:"list"};
  assert.equal(api.validate({...sampleSection}).kicker,"STUDY TOOLS");
  assert.throws(()=>api.validate({...sampleSection,kicker:"X".repeat(49)}),/kicker/);
  assert.equal(api.validate({...state.published[0],eyebrow:"STUDY UTILITIES",
    emoji:"📚"}).eyebrow,"STUDY UTILITIES");
  assert.throws(()=>api.validate({...state.published[0],eyebrow:"X".repeat(41)}),/eyebrow/);
  assert.throws(() => api.validate({
    ...state.published[0],button_label:"A".repeat(23)
  }),/Button label/);
  click("Activity");
  await wait();
  assert.ok([...w.document.querySelectorAll("#sladmin-content button")]
    .some(b=>b.textContent==="Clear preview history"));
  assert.ok([...w.document.querySelectorAll("#sladmin-content button")]
    .some(b=>b.textContent==="Undo" && b.disabled));
  const clearResult = await api.history("clear_all");
  assert.ok(clearResult.cleared>=2);
  assert.equal((await api.activity()).length,0);
  click("Content");
  await wait();
  assert.throws(
    () => api.validate({ ...state.published[0], url: "javascript:alert(1)" }),
    /not supported|Only normal HTTP or HTTPS/,
  );
  assert.throws(
    () => api.validate({ ...state.published[0], url: "//evil.example" }),
    /valid HTTPS|ordinary website link|site-relative path/,
  );
  assert.throws(
    () =>
      api.validate({
        ...state.published[0],
        url: "https://user:pass@example.org",
      }),
    /not supported|Only normal HTTP or HTTPS/,
  );
  // New preview actions only mutate local state.
  const temp = { ...state.published[0], id: "custom-deletable-test",
    title: "Discard me", page: "maths.html" };
  await api.save(temp,0,"publish");
  await api.deleteContent({ id:temp.id, draft:temp,revision:1,builtin:false });
  assert.equal(JSON.parse(w.localStorage.getItem("studylab-admin-preview-v1"))
    .published.some(x=>x.id===temp.id),false);
  await api.popupSet("create", {
    title:"Hello StudyLab",message:"One-time notice",variant:"info",
    placement:"top-right",display_seconds:8,link:"",
    starts_at:new Date().toISOString(),
  });
  assert.equal((await api.popups()).length,1);
  await api.popupSet("create", {
    title:"Longer announcement",message:"Extended expiry preview",variant:"important",
    placement:"top-right",display_seconds:8,expiry_period:"1y",link:"",
    starts_at:new Date().toISOString(),
  });
  const longPopup=(await api.popups()).find(x=>x.title==="Longer announcement");
  assert.equal(longPopup.expiry_period,"1y");
  assert(Date.parse(longPopup.expires_at)-Date.parse(longPopup.starts_at)>360*86400000);
  const sample = JSON.parse(w.localStorage.getItem("studylab-admin-preview-v1")).users[2];
  await api.banUser(sample.id,24,"Test moderation");
  assert.equal(JSON.parse(w.localStorage.getItem("studylab-admin-preview-v1"))
    .users.find(x=>x.id===sample.id).banned,true);
  dom.window.close();
  // Live accounts and site metrics must be visible to admins but read-only.
  ({ dom, w, calls } = await setup(true, {
    liveStats: { profiles: 575, registered: 14, guests: 561, admins: 3, social_posts: 32, reports: 2 },
    liveUsers: { rows: [
      { id: "11111111-1111-4111-8111-111111111111", display_name: "Real Student",
        username: "realstudent", admin: false, verified: false, guest: false,
        created_at: "2026-11-01T00:00:00Z" },
    ], total: 575 },
  }));
  assert.equal(w.StudyLabAdminAPI.readonlyLive, true);
  assert.deepEqual([...w.document.querySelectorAll(".sladmin-stats .sladmin-stat")]
    .map(x => x.textContent), ["575","3","14","32"]);
  assert.match(w.document.querySelector("#sladmin-mode").textContent,
    /real StudyLab profiles/i);
  assert.ok(calls.includes("studylab_admin_readonly_users_v1"));
  w.document.querySelectorAll("#sladmin-tabs button")[1].click();
  await wait();
  assert.match(w.document.querySelector(".sladmin-row").textContent, /Real Student/);
  assert.equal([...w.document.querySelectorAll(".sladmin-row-actions button")]
    .filter(b => /badge|admin/i.test(b.textContent)).every(b => b.disabled), true);
  await assert.rejects(
    w.StudyLabAdminAPI.setUser("11111111-1111-4111-8111-111111111111", "admin", true),
    /read-only/,
  );
  dom.window.close();
  // PR #102 connected mode must use REAL server-side admin RPCs, not local
  // state, and must let registered users be managed by authenticated admins.
  ({ dom, w, calls } = await setup(true, {
    connected: true,
    liveStats: { profiles: 575, registered: 14, guests: 561,
                 admins: 3, social_posts: 32, reports: 2 },
    liveUsers: { rows: [
      { id: "11111111-1111-4111-8111-111111111111", display_name: "Registered",
        username: "registered", admin: false, verified: false, guest: false,
        created_at: "2026-11-01T00:00:00Z" }
    ], total: 14 },
  }));
  assert.equal(w.StudyLabAdminAPI.connectedPreview, true);
  assert.equal(w.StudyLabAdminAPI.preview, false);
  assert.equal(w.document.querySelector("#sladmin-mode").hidden,false,
    "The connected Admin preview must clearly warn that edits modify live Supabase");
  assert.match(w.document.querySelector("#sladmin-mode").textContent,
    /real StudyLab database/);
  assert.ok(calls.includes("studylab_admin_users"));
  assert.ok(calls.includes("studylab_admin_content_list"));
  w.document.querySelectorAll("#sladmin-tabs button")[1].click();
  await wait();
  const registeredButtons = [...w.document.querySelectorAll(".sladmin-row-actions button")];
  assert.equal(registeredButtons.filter(b=>/badge|admin/i.test(b.textContent))
    .every(b=>!b.disabled), true);
  await w.StudyLabAdminAPI.setUser("11111111-1111-4111-8111-111111111111","verified",true);
  assert.ok(calls.includes("studylab_admin_action_v2"));
  await w.StudyLabAdminAPI.banUser(
    "11111111-1111-4111-8111-111111111111",24,"Test review");
  assert.ok(calls.includes("studylab-admin-ban"));
  assert.ok([...w.document.querySelectorAll("#sladmin-tabs button")]
    .some(x=>x.textContent==="Pop-up Messages"));
  assert.equal(w.localStorage.getItem("studylab-admin-preview-v1"), null,
    "Connected mode must not create local sample-user data");
  dom.window.close();
  // A corrupted or older per-device preview schema must not produce a blank dashboard.
  ({ dom, w } = await setup(true, {
    previewData: JSON.stringify({
      owner: "24e78cd0-4565-407a-96f7-9cfde083f6d2",
      content: null, users: null, activity: null, published: null, media: null,
    }),
    themeMode: "system",
    prefersDark: false,
  }));
  assert.equal(w.document.querySelectorAll(".sladmin-stats .sladmin-card").length, 4);
  assert.equal(w.document.documentElement.dataset.theme, "light");
  assert.equal(w.document.documentElement.dataset.themeMode, "system");
  assert.equal(JSON.parse(w.localStorage.getItem("studylab-admin-preview-v1")).users.length, 5);
  w.document.querySelector("#sladmin-theme").click();
  assert.equal(w.document.documentElement.dataset.theme, "dark");
  assert.equal(w.localStorage.getItem("studylab-room-mode-v1"), "dark");
  dom.window.close();
  // Recent activity is a daily Colombo-time panel, NOT the full audit log.
  const nowStamp = new Date().toISOString();
  const yesterdayStamp = new Date(Date.now()-86400000).toISOString();
  ({dom,w} = await setup(true, {
    previewData: JSON.stringify({
      owner:"24e78cd0-4565-407a-96f7-9cfde083f6d2",
      activity:[
        {id:"old",action:"Yesterday action",target:"not today",created_at:yesterdayStamp},
        {id:"new",action:"Today's action",target:"visible",created_at:nowStamp},
      ],
    }),
  }));
  const todayPanel = w.document.querySelector(".sladmin-overview-grid").textContent;
  assert.match(todayPanel,/Today's action/);
  assert.doesNotMatch(todayPanel,/Yesterday action/);
  dom.window.close();
  // The admin CMS may move/reorder extra sections after page load.
  // More belongs after the final built-in panel, before custom sections.
  const cmsDom = new JSDOM(`<main>
    <section class="sl-home-section" id="free-lesson-packs" data-cms-id="free-lesson-packs" data-cms-order="70">
      <h2>Free Lesson Packs</h2><p>Lessons</p></section>
    <div id="more-learning-resources" class="sl-home-more-anchor"></div>
    </main>`,{
      url:"https://preview.example/index.html",runScripts:"outside-only",
      pretendToBeVisual:true
    });
  const cmsWindow = cmsDom.window;
  if (!cmsWindow.CSS) cmsWindow.CSS = {};
  cmsWindow.CSS.escape = value=>String(value);
  cmsWindow.StudyLabAdminConfig = {mode:"preview"};
  cmsWindow.StudyLabAccount = {
    startup:Promise.resolve(),
    client:{
      auth:{getUser:async()=>({data:{user:{id:"24e78cd0-4565-407a-96f7-9cfde083f6d2"}}})},
      rpc:async()=>({data:true}),
      from(table){
        assert.equal(table,"studylab_site_content");
        return {select(){
          return {eq(){return {limit:async()=>({data:[],error:null})}}};
        }};
      }
    }
  };
  cmsWindow.localStorage.setItem("studylab-admin-preview-v1",JSON.stringify({
    owner:"24e78cd0-4565-407a-96f7-9cfde083f6d2",
    published:[{
      id:"custom-cms-test",kind:"section",page:"index.html",
      title:"Test",description:"Admin section",order:100,
      layout:"cards",hidden:false
    }]
  }));
  cmsWindow.eval(read("assets/js/studylab-content.js"));
  await wait();
  const free = cmsWindow.document.getElementById("free-lesson-packs");
  const more = cmsWindow.document.getElementById("more-learning-resources");
  const custom = cmsWindow.document.getElementById("custom-cms-test");
  assert.ok(custom,"Admin custom section should render");
  assert.equal(free.nextElementSibling,more,"More anchor stays immediately after Lessons");
  assert.equal(more.nextElementSibling,custom,"More scroll reveals the added section");
  cmsDom.window.close();
  // One failed API request must not suppress the overview stats or its actions.
  ({ dom, w } = await setup(true, { failOverview: true }));
  assert.equal(w.document.querySelector("#sladmin-workspace").hidden, false);
  assert.equal(w.document.querySelectorAll(".sladmin-stats .sladmin-card").length, 4);
  assert.match(w.document.querySelector(".sladmin-data-warning").textContent,
    /Test overview request failed/);
  assert.equal(w.document.querySelector("#sladmin-save-state").textContent, "Some data unavailable");
  assert.equal(w.document.querySelectorAll(".sladmin-overview-grid .sladmin-quick").length, 6);
  assert.match(w.document.querySelector(".sladmin-build-label").textContent,
    /Local preview · Isolated/);
  dom.window.close();
  const adminMarkup = read("admin.html");
  assert.match(adminMarkup, /studylab-admin\.js\?v=guardian-v1/);
  assert.match(adminMarkup, /studylab-admin-guardian[.]js[?]v=polish-v1/);
  assert.match(adminMarkup, /studylab-admin-guardian[.]css[?]v=polish-v1/);
  assert.match(adminMarkup, /Loading dashboard/);
  assert.match(adminMarkup, /pr115-host-verified-v1/);
  assert.match(adminMarkup, /studylab-admin-config[.]js[?]v=pr115-host-verified-v1/);
  assert.match(read("index.html"), /studylab-popups[.]js[?]v=pr109-live-v1/);
  assert.match(read("index.html"), /studylab-content[.]js[?]v=pr114-custom-sections-v1/);
  assert.match(adminMarkup,
    /class="sladmin-brand-mark" aria-hidden="true"><img\b[^>]*\bsrc="assets\/icon\/studylab-pwa\.svg(?:\?[^"]*)?"/,
    "Admin header uses the primary StudyLab icon");
  assert.match(adminMarkup,/sladmin-back-icon/);
  assert.match(adminMarkup,/studylab-popups.css/);
  // New sections must use the same translucent panels as StudyLab,
  // with capped thumbnails and an actual glass-style Open control.
  const contentCss = read("assets/css/studylab-content.css");
  assert.match(contentCss, /PR #102 glass parity/);
  assert.match(contentCss, /max-height:146px/);
  assert.ok(contentCss.includes("section.sl-cms-section > .sl-cms-grid"));
  assert.ok(contentCss.includes(".sl-cms-card .sl-cms-open"));
  assert.match(contentCss,/max-width:100%/);
  assert.match(contentCss,/overflow-wrap:anywhere/);
  assert.match(read("assets/css/studylab-popups.css"),/slpopup-link-preview/);
  assert.match(read("index.html"),
    /studylab-content[.]css[?]v=pr114-custom-sections-v1/,
    "Home must use the refreshed custom section stylesheet");
  for (const page of ["maths.html","physics.html",
      "chemistry.html","biology.html","lesson-packs.html"]) {
    assert.match(read(page),
      /studylab-content[.]css[?]v=pr102-public-rest-v3/,
      page + " must retain the existing CMS stylesheet");
  }
  const telegramMarkup=read("Telegram_Channels.html");
  assert.match(telegramMarkup,/studylab-content[.]css[?]v=pr112-channel-avatars-v1/);
  assert.match(telegramMarkup,/studylab-special-resources[.]js[?]v=pr112-browser-v2/);
  assert.match(telegramMarkup,/telegram-channel-browser[.]css[?]v=pr112-glass-nav-v5/);
  assert.match(telegramMarkup,/telegram-channel-browser[.]js[?]v=pr112-glass-nav-v4/);
  assert.ok(!read("assets/js/telegram-channel-browser.js").includes("window.location ="),
    "View All and filter navigation must remain on the Telegram page");
  assert.doesNotMatch(telegramMarkup, /class="telegram-featured-count"/,
    "Original A/L Lessons featured card must not show the automatic Sinhala subscriber line");
  assert.match(telegramMarkup, /A\/L Lessons — @AL_LESSONS/,
    "Keep the original featured channel's title and description");
  assert.match(telegramMarkup, /href="https:\/\/t[.]me\/AL_LESSONS"/,
    "Keep the original featured channel's Join button");
  assert.match(adminMarkup,/studylab-admin-publisher[.]js[?]v=pr114-custom-sections-v1/);
  assert.match(adminMarkup,/studylab-admin[.]css[?]v=pr114-sleek-icons-v1/);
  assert.match(telegramMarkup,/studylab-content[.]js[?]v=pr112-carousel-settings-v3/);
  assert.match(adminMarkup,/studylab-admin[.]js[?]v=guardian-v1/);
  assert.match(read("assets/css/telegram-channel-browser.css"),
    /repeat\(4,minmax\(0,1fr\)\)/,
    "Collapsed All Subjects uses four columns on desktop");
  assert.match(read("assets/js/studylab-admin-publisher.js"),
    /auto_advance_seconds/,
    "Admin carousel timing must use the existing publishing workflow");
  const homeHtml = read("index.html");
  const sidebarJs = read("assets/js/home-sidebar.js");
  const cmsJs = read("assets/js/studylab-content.js");
  assert.match(homeHtml,/id="more-learning-resources"/);
  assert.match(homeHtml,/home-sidebar[.]js[?]v=13-responsive/);
  assert.match(homeHtml,/home-responsive-navigation[.]css[?]v=1/);
  assert.match(sidebarJs,/data-nav-id="more"/);
  assert.match(sidebarJs,/href="#more-learning-resources"/);
  assert.match(sidebarJs,/\["more", "more-learning-resources"\]/);
  assert.match(cmsJs,/builtins\[builtins\.length - 1\]\.after\(more\)/);
  assert.match(read("assets/css/home-sidebar.css"),/\.sl-home-more-anchor/);
  const popupCss=read("assets/css/studylab-popups.css");
  assert.match(popupCss,/slpopup-toast/);
  assert.match(popupCss,/scrollbar-width:thin/);
  assert.match(popupCss,/slpopup-paused/);
  assert.match(popupCss,/\.slpopup-message strong/);
  assert.match(read("assets/js/studylab-popups.js"),/studylab_popup_claim/);
  assert.match(read("assets/js/studylab-ban-guard.js"),/studylab_user_ban_status/);
  for(const page of ["index.html","study-room.html","maths.html","physics.html",
      "chemistry.html","biology.html","Telegram_Channels.html","lesson-packs.html"]){
    const source=read(page);
    assert.match(source,/studylab-popups.js/,page+" popups script");
    assert.match(source,/studylab-popup-format.js/,page+" shared formatter");
    assert.match(source,/studylab-ban-guard.js/,page+" ban check");
  }
  assert.ok(!/(?:id|class)="[^"]*\\bad-[^"]*"/.test(adminMarkup),
    "Admin identifiers must not match generic ad-blocker cosmetic selectors");
  assert.ok(!adminMarkup.includes("sladmin-build-proof"),
    "Remove the temporary floating developer diagnostic overlay");
  assert.ok(!adminMarkup.includes('href="assets/css/main.css"'),
    "Admin must use isolated CSS, not global home rules");
  const cardCode = read("assets/js/studylab-content.js");
  assert.ok(cardCode.includes('window.StudyLabSpecialResources?.buttonLabel'));
  assert.ok(!cardCode.includes('"Open resource →"'));
  const popupCode = read("assets/js/studylab-popups.js");
  assert.ok(popupCode.includes('item.link_label || "View"'));
  assert.ok(!popupCode.includes('"Open resource →"'));
  const adminCss = read("assets/css/studylab-admin.css");
  assert.ok(adminCss.includes("button.sladmin-danger:not(:disabled)"));
  assert.match(adminCss, /content: "ADMIN DASHBOARD"/);
  assert.match(adminCss, /backdrop-filter: blur\(27px\)/);
  assert.match(read("netlify.toml"), /for = "\/admin\.html"[\s\S]*?no-store/);
  ({ dom, w } = await setup(false));
  assert.equal(w.document.querySelector("#sladmin-workspace").hidden, true);
  assert.match(
    w.document.querySelector("#sladmin-gate").textContent,
    /does not have admin/,
  );
  dom.window.close();
  const seed = JSON.parse(read("assets/data/admin-content-seed.json"));
  assert.equal(new Set(seed.map((x) => x.id)).size, seed.length);
  for (const page of new Set(seed.map((x) => x.page))) {
    const d = new JSDOM(read(page));
    for (const r of seed.filter((x) => x.page === page))
      assert.ok(
        d.window.document.querySelector('[data-cms-id="' + r.id + '"]'),
        "Missing target " + r.id,
      );
    d.window.close();
  }
  console.log(
    "PASS: admin access, seeded content, versioned assets, ad-filter-safe IDs, real read-only accounts, liquid glass, immediate Overview, partial API failure recovery, system theme, badges and zero remote preview mutations.",
  );
})();
