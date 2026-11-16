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
  click("Users");
  await wait();
  assert.equal(w.document.querySelectorAll(".sladmin-row").length, 5);
  click("Give blue badge");
  await wait();
  assert.ok(
    JSON.parse(w.localStorage.getItem("studylab-admin-preview-v1")).activity
      .length >= 2,
  );
  assert.deepEqual(calls, ["studylab_social_is_admin","studylab_admin_readonly_stats_v1"]);
  const api = w.StudyLabAdminAPI;
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
  assert.ok(calls.includes("studylab_admin_user_set"));
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
  // One failed API request must not suppress the overview stats or its actions.
  ({ dom, w } = await setup(true, { failOverview: true }));
  assert.equal(w.document.querySelector("#sladmin-workspace").hidden, false);
  assert.equal(w.document.querySelectorAll(".sladmin-stats .sladmin-card").length, 4);
  assert.match(w.document.querySelector(".sladmin-data-warning").textContent,
    /Test overview request failed/);
  assert.equal(w.document.querySelector("#sladmin-save-state").textContent, "Some data unavailable");
  assert.equal(w.document.querySelectorAll(".sladmin-overview-grid .sladmin-quick").length, 6);
  assert.match(w.document.querySelector(".sladmin-build-label").textContent,
    /Local preview · PR #102/);
  dom.window.close();
  const adminMarkup = read("admin.html");
  assert.match(adminMarkup, /studylab-admin\.js\?v=pr102-connected-admin-20261116-v9/);
  assert.match(adminMarkup, /Loading dashboard/);
  assert.match(adminMarkup,/sladmin-brand-mark" aria-hidden="true">ツ/);
  assert.match(adminMarkup,/sladmin-back-icon/);
  assert.match(adminMarkup,/studylab-popups.css/);
  // New sections must use the same translucent panels as StudyLab,
  // with capped thumbnails and an actual glass-style Open control.
  const contentCss = read("assets/css/studylab-content.css");
  assert.match(contentCss, /PR #102 glass parity/);
  assert.match(contentCss, /max-height:146px/);
  assert.ok(contentCss.includes("section.sl-cms-section > .sl-cms-grid"));
  assert.ok(contentCss.includes(".sl-cms-card .sl-cms-open"));
  for (const page of ["index.html","maths.html","physics.html",
      "chemistry.html","biology.html","Telegram_Channels.html",
      "lesson-packs.html"]) {
    assert.match(read(page),
      /studylab-content[.]css[?]v=pr102-glass-cards-20261116-v10/,
      page + " must fetch the new CSS instead of stale browser copies");
  }
  const popupCss=read("assets/css/studylab-popups.css");
  assert.match(popupCss,/slpopup-toast/);
  assert.match(read("assets/js/studylab-popups.js"),/studylab_popup_claim/);
  assert.match(read("assets/js/studylab-ban-guard.js"),/studylab_user_ban_status/);
  for(const page of ["index.html","study-room.html","maths.html","physics.html",
      "chemistry.html","biology.html","Telegram_Channels.html","lesson-packs.html"]){
    const source=read(page);
    assert.match(source,/studylab-popups.js/,page+" popups script");
    assert.match(source,/studylab-ban-guard.js/,page+" ban check");
  }
  assert.ok(!/(?:id|class)="[^"]*\\bad-[^"]*"/.test(adminMarkup),
    "Admin identifiers must not match generic ad-blocker cosmetic selectors");
  assert.ok(!adminMarkup.includes("sladmin-build-proof"),
    "Remove the temporary floating developer diagnostic overlay");
  assert.ok(!adminMarkup.includes('href="assets/css/main.css"'),
    "Admin must use isolated CSS, not global home rules");
  const adminCss = read("assets/css/studylab-admin.css");
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
