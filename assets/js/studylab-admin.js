(function () {
  "use strict";
  const $ = (s) => document.querySelector(s),
    api = window.StudyLabAdminAPI;
  const tabs = [
    "Overview",
    "Users",
    "Admins",
    "Content",
    "Sections",
    "Media",
    "Activity",
  ];
  let active = "Overview",
    rows = [],
    editing = null,
    dirty = false,
    page = 0,
    request = 0,
    info;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  function button(text, fn, cls) {
    const b = el("button", text, cls);
    b.type = "button";
    b.addEventListener("click", () => run(fn, b));
    return b;
  }
  async function run(fn, b) {
    if (b) b.disabled = true;
    try {
      await fn();
    } catch (e) {
      status(e.message, true);
    } finally {
      if (b) b.disabled = false;
    }
  }
  function status(text, error = false) {
    $("#ad-status").textContent = text;
    $("#ad-status").dataset.error = String(error);
  }
  function setDirty(value) {
    dirty = value;
    $("#ad-save-state").textContent = value
      ? "Unsaved changes"
      : "All changes saved";
  }
  function closeEditor() {
    if (dirty && !confirm("Discard your unsaved changes?")) return;
    setDirty(false);
    $("#ad-editor").close();
  }
  $("#ad-close").onclick = closeEditor;
  $("#ad-editor").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeEditor();
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  function theme() {
    const t =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = t;
    localStorage.setItem("etools-theme", t);
  }
  document.documentElement.dataset.theme =
    localStorage.getItem("etools-theme") || "dark";
  $("#ad-theme").onclick = theme;
  function row(title, subtitle, actions = [], initial = "↗") {
    const r = el("div", undefined, "ad-row"),
      copy = el("div", undefined, "ad-row-copy"),
      a = el("div", undefined, "ad-row-actions");
    copy.append(el("strong", title), el("small", subtitle));
    a.append(...actions);
    r.append(el("span", initial, "ad-avatar"), copy, a);
    return r;
  }
  function empty(host, message) {
    host.append(el("div", message, "ad-empty"));
  }
  async function navigate(tab) {
    active = tab;
    page = 0;
    $("#ad-title").textContent = tab;
    $("#ad-kicker").textContent =
      tab === "Overview"
        ? "YOUR COMMUNITY AT A GLANCE"
        : "MANAGE " + tab.toUpperCase();
    for (const b of $("#ad-tabs").children)
      b.setAttribute("aria-current", b.textContent === tab ? "page" : "false");
    status("");
    await render();
  }
  async function render() {
    const version = ++request,
      host = $("#ad-content");
    host.replaceChildren();
    if (active === "Overview") return overview(host, version);
    if (active === "Users" || active === "Admins")
      return userList(host, version);
    if (active === "Content" || active === "Sections")
      return contentList(host, version);
    if (active === "Media") return mediaList(host, version);
    const entries = await api.activity();
    if (version !== request) return;
    const list = el("div", undefined, "ad-list");
    host.append(list);
    if (!entries.length) empty(list, "Your team’s changes will appear here.");
    for (const a of entries)
      list.append(
        row(
          a.action,
          a.target + " · " + new Date(a.created_at).toLocaleString(),
          [],
          "↻",
        ),
      );
  }
  async function overview(host, version) {
    const [content, users, admins, activity] = await Promise.all([
      api.content(),
      api.users(),
      api.users("", 0, true),
      api.activity(),
    ]);
    if (version !== request) return;
    const stats = el("div", undefined, "ad-stats");
    for (const [n, label] of [
      [users.total, api.preview ? "Preview accounts" : "Student accounts"],
      [admins.total, "Administrators"],
      [content.filter((x) => x.draft.kind === "card").length, "Content cards"],
      [
        content.filter((x) => x.revision && !x.draft.hidden).length,
        "Edited items",
      ],
    ]) {
      const c = el("article", undefined, "ad-card");
      c.append(
        el("div", label, "ad-stat-label"),
        el("div", String(n), "ad-stat"),
      );
      stats.append(c);
    }
    host.append(stats);
    const grid = el("div", undefined, "ad-overview-grid"),
      quick = el("article", undefined, "ad-card"),
      recent = el("article", undefined, "ad-card");
    quick.append(
      el("h3", "Make something useful happen"),
      el("p", "Keep resources fresh and your community supported."),
    );
    for (const [title, tab] of [
      ["Manage learning resources →", "Content"],
      ["Review users & verification →", "Users"],
      ["Arrange homepage sections →", "Sections"],
    ])
      quick.append(button(title, () => navigate(tab), "ad-quick"));
    recent.append(el("h3", "Recent activity"));
    if (!activity.length)
      recent.append(
        el("p", "A clean slate. Your next change will show up here."),
      );
    for (const a of activity.slice(0, 4))
      recent.append(el("p", a.action + " · " + a.target));
    if (api.preview)
      recent.append(
        button("Reset preview changes", () => {
          if (
            confirm("Reset the changes saved in this preview on this device?")
          )
            api.reset();
        }),
      );
    grid.append(quick, recent);
    host.append(grid);
  }
  async function userList(host, version) {
    const toolbar = el("div", undefined, "ad-toolbar"),
      search = el("input");
    search.placeholder = "Search name or username";
    search.setAttribute("aria-label", "Search users");
    const list = el("div", undefined, "ad-list"),
      pager = el("div", undefined, "ad-pager");
    toolbar.append(search);
    host.append(toolbar, list, pager);
    let timer,
      sequence = 0;
    async function load() {
      const seq = ++sequence;
      const data = await api.users(
        search.value.trim(),
        page,
        active === "Admins",
      );
      if (seq !== sequence || version !== request) return;
      list.replaceChildren();
      pager.replaceChildren();
      if (!data.rows.length) empty(list, "No matching users.");
      for (const u of data.rows) {
        const actions = [
          button("View profile", () => viewUser(u)),
          button(u.verified ? "Remove badge" : "Give blue badge", async () => {
            if (
              confirm(
                (u.verified ? "Remove" : "Give") +
                  " the blue badge for " +
                  u.display_name +
                  "?",
              )
            ) {
              await api.setUser(u.id, "verified", !u.verified);
              await load();
            }
          }),
          button(u.admin ? "Remove admin" : "Make admin", async () => {
            if (
              confirm(
                (u.admin
                  ? "Remove admin access from "
                  : "Give full admin access to ") +
                  u.display_name +
                  "?",
              )
            ) {
              await api.setUser(u.id, "admin", !u.admin);
              await load();
            }
          }),
        ];
        if (u.id === info.user.id) actions[2].disabled = true;
        list.append(
          row(
            u.display_name || "Student",
            "@" +
              (u.username || "—") +
              (u.admin ? " · Admin" : "") +
              (u.verified ? " · Verified" : ""),
            actions,
            (u.display_name || "S").slice(0, 1),
          ),
        );
      }
      const prev = button("Previous", async () => {
          page--;
          await load();
        }),
        next = button("Next", async () => {
          page++;
          await load();
        });
      prev.disabled = page === 0;
      next.disabled = (page + 1) * 20 >= data.total;
      pager.append(
        prev,
        el("span", `${data.total} users · Page ${page + 1}`),
        next,
      );
    }
    search.oninput = () => {
      clearTimeout(timer);
      page = 0;
      timer = setTimeout(() => run(load), 250);
    };
    await load();
  }
  function viewUser(u) {
    const dialog = document.createElement("dialog");
    dialog.className = "ad-dialog";
    const head = el("header");
    head.append(
      el("h2", u.display_name || "Student"),
      button("Close", () => dialog.close()),
    );
    dialog.append(head);
    const dl = el("dl", undefined, "ad-user-detail");
    for (const [key, value] of [
      ["Username", "@" + (u.username || "—")],
      ["School", u.school || "Not provided"],
      ["Bio", u.bio || "Not provided"],
      ["Account", u.admin ? "Admin" : "Student"],
      ["Verification", u.verified ? "Blue badge" : "Not verified"],
      [
        "Joined",
        u.created_at ? new Date(u.created_at).toLocaleDateString() : "—",
      ],
      ["User ID", u.id],
    ])
      dl.append(el("dt", key), el("dd", value));
    dialog.append(dl);
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal();
  }
  async function contentList(host, version) {
    rows = await api.content();
    if (version !== request) return;
    const sectionMode = active === "Sections",
      toolbar = el("div", undefined, "ad-toolbar"),
      search = el("input"),
      filter = el("select"),
      list = el("div", undefined, "ad-list");
    search.placeholder = "Find a title…";
    search.setAttribute("aria-label", "Search content");
    filter.setAttribute("aria-label", "Filter page");
    for (const [value, label] of [["", "All pages"], ...pageOptions]) {
      const o = el("option", label);
      o.value = value;
      filter.append(o);
    }
    toolbar.append(
      search,
      filter,
      button(
        sectionMode ? "+ New section" : "+ New card",
        () => edit(null, sectionMode ? "section" : "card"),
        "ad-primary",
      ),
    );
    host.append(toolbar, list);
    function draw() {
      list.replaceChildren();
      const items = rows
        .filter(
          (r) =>
            r.draft.kind === (sectionMode ? "section" : "card") &&
            (!filter.value || r.draft.page === filter.value) &&
            r.draft.title.toLowerCase().includes(search.value.toLowerCase()),
        )
        .sort((a, b) => a.draft.order - b.draft.order);
      if (!items.length) empty(list, "No matching items. Add your first one.");
      for (const r of items) {
        const d = r.draft;
        list.append(
          row(
            d.title,
            `${d.page} · Order ${d.order} · ${r.has_draft ? "Unpublished draft" : d.hidden ? "Hidden" : r.published ? "Published / available" : "Draft"}`,
            [
              button("Edit", () => edit(r)),
              button(d.hidden ? "Restore" : "Hide", async () => {
                if (
                  confirm((d.hidden ? "Restore " : "Hide ") + d.title + "?")
                ) {
                  await api.save(
                    { ...d, hidden: !d.hidden },
                    r.revision,
                    d.hidden ? "restore" : "hide",
                  );
                  await render();
                }
              }),
            ],
            sectionMode ? "▤" : "↗",
          ),
        );
      }
    }
    search.oninput = draw;
    filter.onchange = draw;
    draw();
  }
  const pageOptions = [
    ["index.html", "Home / resources"],
    ["maths.html", "Maths simulations"],
    ["physics.html", "Physics simulations"],
    ["chemistry.html", "Chemistry simulations"],
    ["biology.html", "Biology simulations"],
    ["Telegram_Channels.html", "Telegram channels"],
    ["lesson-packs.html", "Free lesson packs"],
  ];
  function field(name, label, value, type = "text", options) {
    const wrap = el("label");
    wrap.append(el("span", label));
    let input;
    if (options) {
      input = el("select");
      for (const [v, t] of options) {
        const o = el("option", t);
        o.value = v;
        input.append(o);
      }
    } else input = el(type === "textarea" ? "textarea" : "input");
    if (!options && type !== "textarea") input.type = type;
    input.name = name;
    input.value = value ?? "";
    if (type === "checkbox") input.checked = !!value;
    if (["title", "description", "url", "image"].includes(name))
      wrap.className = "ad-wide";
    if (name === "title") {
      input.required = true;
      input.maxLength = 160;
    }
    if (name === "description") input.maxLength = 1500;
    if (type === "number") {
      input.min = "0";
      input.max = "10000";
      input.step = "1";
    }
    wrap.append(input);
    return wrap;
  }
  function edit(record, kind = "card") {
    editing = record || {
      revision: 0,
      draft: {
        id: "custom-" + crypto.randomUUID(),
        kind,
        page: "index.html",
        title: "",
        description: "",
        url: "",
        image: "",
        section: "",
        layout: "cards",
        order: 100,
        hidden: false,
      },
    };
    const d = editing.draft;
    $("#ad-editor-title").textContent = (record ? "Edit " : "New ") + d.kind;
    const fields = el("div", undefined, "ad-fields");
    fields.append(
      field("title", "Title", d.title),
      field("description", "Description", d.description, "textarea"),
    );
    if (d.kind === "card")
      fields.append(
        field("url", "Destination link", d.url),
        field("image", "Image URL (optional)", d.image),
      );
    const page = field(
      "page",
      "Page",
      d.page,
      "text",
      d.kind === "section" ? [pageOptions[0]] : pageOptions,
    );
    page.querySelector("select").disabled = !!record?.builtin;
    fields.append(page, field("order", "Display order", d.order, "number"));
    if (d.kind === "card") {
      fields.append(
        field("section", "Homepage section (optional)", d.section, "text", [
          ["", "Default resource area"],
          ...rows
            .filter(
              (x) =>
                x.draft.kind === "section" &&
                (!x.builtin ||
                  [
                    "other-al-resources",
                    "free-lesson-packs",
                    "telegram-links",
                    "practical-simulations",
                    "past-papers",
                  ].includes(x.id)),
            )
            .map((x) => [x.id, x.draft.title]),
        ]),
      );
    } else if (!record?.builtin)
      fields.append(
        field("layout", "Section layout", d.layout || "cards", "text", [
          ["cards", "Card grid"],
          ["list", "List"],
        ]),
      );
    fields.append(
      field("hidden", "Hidden from students", d.hidden, "checkbox"),
    );
    $("#ad-fields").replaceChildren(fields);
    $("#ad-editor-status").textContent = "";
    $(".ad-editor-actions").hidden = false;
    setDirty(false);
    $("#ad-editor").showModal();
  }
  $("#ad-form").addEventListener("input", () => setDirty(true));
  function payload() {
    const form = $("#ad-form"),
      d = { ...editing.draft };
    for (const n of [
      "title",
      "description",
      "url",
      "image",
      "page",
      "section",
      "layout",
    ])
      if (form.elements[n]) d[n] = form.elements[n].value.trim();
    d.order = Number(form.elements.order.value);
    d.hidden = form.elements.hidden.checked;
    return api.validate(d);
  }
  $("#ad-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter;
    const buttons = [...$(".ad-editor-actions").querySelectorAll("button")];
    buttons.forEach((x) => (x.disabled = true));
    try {
      const d = payload(),
        action = b?.value || "draft";
      await api.save(d, editing.revision, action);
      setDirty(false);
      $("#ad-editor").close();
      await render();
      status(
        api.preview
          ? "Saved in this preview on this device."
          : action === "publish"
            ? "Published successfully."
            : "Draft saved.",
      );
    } catch (err) {
      $("#ad-editor-status").textContent = err.message;
    } finally {
      buttons.forEach((x) => (x.disabled = false));
    }
  };
  $("#ad-preview").onclick = () => {
    try {
      const d = payload();
      localStorage.setItem(
        "studylab-admin-draft-preview",
        JSON.stringify({ owner: info.user.id, item: d }),
      );
      window.open(d.page + "?admin-preview=1", "_blank", "noopener");
    } catch (e) {
      $("#ad-editor-status").textContent = e.message;
    }
  };
  async function mediaList(host, version) {
    const toolbar = el("div", undefined, "ad-toolbar"),
      input = el("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,application/pdf";
    input.setAttribute("aria-label", "Choose an image or PDF");
    toolbar.append(
      input,
      button("Upload file", async () => {
        if (!input.files[0]) throw Error("Choose a file first.");
        await api.upload(input.files[0]);
        await render();
        status("File uploaded. Copy its URL into a content card.");
      }),
    );
    host.append(
      toolbar,
      el(
        "p",
        api.preview
          ? "Preview: files under 1 MB, saved on this device. Live uploads support up to 5 MB."
          : "JPG, PNG, WebP or PDF · Up to 5 MB · Most recent 100 files.",
      ),
    );
    const entries = await api.media();
    if (version !== request) return;
    const grid = el("div", undefined, "ad-media-grid");
    host.append(grid);
    if (!entries.length)
      empty(
        grid,
        "Your uploaded images and learning resources will appear here.",
      );
    for (const m of entries) {
      const c = el("article", undefined, "ad-card");
      if (
        /\.(png|jpe?g|webp)$/i.test(m.name) ||
        m.url.startsWith("data:image/")
      ) {
        const img = el("img");
        img.src = m.url;
        img.alt = "";
        c.append(img);
      }
      c.append(
        el("strong", m.name),
        button("Copy URL", async () => {
          await navigator.clipboard.writeText(m.url);
          status("URL copied.");
        }),
        button("Remove", async () => {
          if (
            confirm(
              "Remove this file? Any cards using it will need another file.",
            )
          ) {
            await api.removeMedia(m.path);
            await render();
          }
        }),
      );
      grid.append(c);
    }
  }
  for (const tab of tabs)
    $("#ad-tabs").append(button(tab, () => navigate(tab)));
  (async () => {
    try {
      info = await api.init();
      $("#ad-gate").hidden = true;
      $("#ad-workspace").hidden = false;
      $("#ad-identity").textContent = "Administrator";
      $("#ad-mode").append(
        el("strong", api.preview ? "Preview workspace. " : "Live workspace. "),
        document.createTextNode(
          api.preview
            ? "Changes stay on this device. User actions use sample accounts; real accounts and production content are untouched."
            : "Published edits are visible to students. Drafts stay private.",
        ),
      );
      await navigate("Overview");
    } catch (e) {
      $("#ad-gate").textContent = e.message;
      $("#ad-identity").textContent = "Access restricted";
    }
  })();
})();
