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
        return { data: admin };
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
  assert.deepEqual(calls, ["studylab_social_is_admin"]);
  const api = w.StudyLabAdminAPI;
  assert.throws(
    () => api.validate({ ...state.published[0], url: "javascript:alert(1)" }),
    /not supported/,
  );
  assert.throws(
    () => api.validate({ ...state.published[0], url: "//evil.example" }),
    /valid HTTPS/,
  );
  assert.throws(
    () =>
      api.validate({
        ...state.published[0],
        url: "https://user:pass@example.org",
      }),
    /not supported/,
  );
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
  assert.equal(w.document.querySelectorAll(".sladmin-overview-grid .sladmin-quick").length, 5);
  assert.match(w.document.querySelector(".sladmin-build-label").textContent,
    /PR #102 preview/);
  dom.window.close();
  const adminMarkup = read("admin.html");
  assert.match(adminMarkup, /studylab-admin\.js\?v=pr102-admin-safe-20261116-v6/);
  assert.match(adminMarkup, /Loading dashboard/);
  assert.ok(!/(?:id|class)="[^"]*\\bad-[^"]*"/.test(adminMarkup),
    "Admin identifiers must not match generic ad-blocker cosmetic selectors");
  assert.match(adminMarkup, /PR #102 · v6 · HTML loaded/);
  assert.ok(!adminMarkup.includes('href="assets/css/main.css"'),
    "Admin must use isolated CSS, not global home rules");
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
    "PASS: admin access, seeded content, versioned assets, ad-filter-safe IDs, immediate Overview, partial API failure recovery, system theme, badges and zero remote preview mutations.",
  );
})();
