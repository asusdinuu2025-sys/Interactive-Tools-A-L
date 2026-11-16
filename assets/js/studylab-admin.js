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
    "Pop-up Messages",
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
    $("#sladmin-status").textContent = text;
    $("#sladmin-status").dataset.error = String(error);
  }
  function setDirty(value) {
    dirty = value;
    $("#sladmin-save-state").textContent = value
      ? "Unsaved changes"
      : "All changes saved";
  }
  function closeEditor() {
    if (dirty && !confirm("Discard your unsaved changes?")) return;
    setDirty(false);
    $("#sladmin-editor").close();
  }
  $("#sladmin-close").onclick = closeEditor;
  $("#sladmin-editor").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeEditor();
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  // Match the Home theme choice, including System and OS colour changes.
  const THEME_KEY = "studylab-room-mode-v1";
  const themeMedia = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)") : { matches: true };
  const themeModes = ["dark", "light", "system"];
  let themeMode = "dark";
  try {
    const saved = localStorage.getItem(THEME_KEY) ||
      localStorage.getItem("etools-theme");
    if (themeModes.includes(saved)) themeMode = saved;
  } catch (_) {}
  function applyTheme(mode, save) {
    themeMode = themeModes.includes(mode) ? mode : "dark";
    const resolved = themeMode === "system"
      ? (themeMedia.matches ? "dark" : "light") : themeMode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeMode = themeMode;
    const labels = { dark: "Dark", light: "Light", system: "System" };
    $("#sladmin-theme").textContent = "◐ " + labels[themeMode];
    $("#sladmin-theme").setAttribute("aria-label",
      "Theme: " + labels[themeMode] + ". Switch colour theme");
    if (save) {
      try {
        localStorage.setItem(THEME_KEY, themeMode);
        localStorage.setItem("etools-theme", themeMode);
      } catch (_) {}
    }
  }
  applyTheme(themeMode, false);
  $("#sladmin-theme").onclick = () => applyTheme(
    { dark: "light", light: "system", system: "dark" }[themeMode], true);
  if (typeof themeMedia.addEventListener === "function") {
    themeMedia.addEventListener("change", () => {
      if (themeMode === "system") applyTheme(themeMode, false);
    });
  }
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_KEY || event.key === "etools-theme") {
      const next = event.newValue;
      if (themeModes.includes(next)) applyTheme(next, false);
    }
  });
  function row(title, subtitle, actions = [], initial = "↗") {
    const r = el("div", undefined, "sladmin-row"),
      copy = el("div", undefined, "sladmin-row-copy"),
      a = el("div", undefined, "sladmin-row-actions");
    copy.append(el("strong", title), el("small", subtitle));
    a.append(...actions);
    r.append(el("span", initial, "sladmin-avatar"), copy, a);
    return r;
  }
  function empty(host, message) {
    host.append(el("div", message, "sladmin-empty"));
  }
  async function navigate(tab) {
    active = tab;
    page = 0;
    $("#sladmin-title").textContent = tab;
    $("#sladmin-kicker").textContent =
      tab === "Overview"
        ? "YOUR COMMUNITY AT A GLANCE"
        : "MANAGE " + tab.toUpperCase();
    for (const b of $("#sladmin-tabs").children)
      b.setAttribute("aria-current", b.textContent === tab ? "page" : "false");
    status("");
    await render();
  }
  async function render() {
    const version = ++request, host = $("#sladmin-content");
    host.replaceChildren(el("div", "Loading " + active.toLowerCase() + "…", "sladmin-loading"));
    host.setAttribute("aria-busy", "true");
    status("Loading " + active.toLowerCase() + "…");
    try {
      await renderPanel(host, version);
      if (version === request) {
        const partial = host.querySelector(".sladmin-data-warning:not([hidden])");
        status(partial ? "Some data is unavailable; the rest of the dashboard still works." : "",
          Boolean(partial));
        if (!dirty) $("#sladmin-save-state").textContent = partial
          ? "Some data unavailable"
          : (api.readonlyLive ? "Real data · read-only preview" :
            api.preview ? "Preview saved on this device" : "All changes saved");
      }
    } catch (e) {
      if (version !== request) return;
      const message = e?.message || "An unexpected error occurred.";
      status("Could not load " + active + ": " + message, true);
      $("#sladmin-save-state").textContent = "Load failed";
      host.replaceChildren();
      const panel = el("div", undefined, "sladmin-error-panel");
      panel.setAttribute("role", "alert");
      panel.append(
        el("h3", "This area could not load"),
        el("p", "Your admin access is still protected. No changes were made."),
        el("p", message),
        button("Try loading again", () => render(), "sladmin-primary"),
      );
      host.append(panel);
    } finally {
      if (version === request) host.removeAttribute("aria-busy");
    }
  }
  async function renderPanel(host, version) {
    host.replaceChildren();
    if (active === "Overview") return overview(host, version);
    if (active === "Users" || active === "Admins")
      return userList(host, version);
    if (active === "Content" || active === "Sections")
      return contentList(host, version);
    if (active === "Media") return mediaList(host, version);
    if (active === "Pop-up Messages") return popupList(host, version);
    const entries = await api.activity();
    if (version !== request) return;
    const list = el("div", undefined, "sladmin-list");
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
    // Paint the workspace FIRST. No failing or stalled request may make
    // the entire Overview disappear, including its navigation.
    const stats = el("div", undefined, "sladmin-stats");
    const real = api.liveStats;
    const metricLabels = real ? [
      "Student profiles · live",
      "Administrators · live",
      "Registered accounts · live",
      "Social posts · live",
    ] : [
      api.preview ? "Preview accounts (sample)" : "Student accounts",
      "Administrators",
      "Content cards",
      "Edited items",
    ];
    const metricValues = [];
    for (const label of metricLabels) {
      const card = el("article", undefined, "sladmin-card");
      const value = el("div", "Loading…", "sladmin-stat");
      value.setAttribute("aria-live", "polite");
      card.append(el("div", label, "sladmin-stat-label"), value);
      metricValues.push(value);
      stats.append(card);
    }

    const grid = el("div", undefined, "sladmin-overview-grid"),
      quick = el("article", undefined, "sladmin-card"),
      recent = el("article", undefined, "sladmin-card"),
      recentItems = el("div", "Loading recent activity…");
    quick.append(
      el("h3", "Manage your StudyLab community"),
      el("p", "Choose an area below to manage its content and settings."),
    );
    for (const [title, tab] of [
      ["Manage learning resources →", "Content"],
      ["Review users & verification →", "Users"],
      ["Review administrator access →", "Admins"],
      ["Arrange homepage sections →", "Sections"],
      ["Upload images and documents →", "Media"],
      ["Send one-time pop-up messages →", "Pop-up Messages"],
    ]) quick.append(button(title, () => navigate(tab), "sladmin-quick"));
    recent.append(el("h3", "Recent activity"), recentItems);
    if (api.connectedPreview) {
      quick.prepend(el("p",
        "CONNECTED PREVIEW · Authorized admin actions here change the live StudyLab database. Review carefully before confirming.",
        "sladmin-preview-explanation"));
    }
    if (api.preview) {
      quick.prepend(el(
        "p",
        real
          ? "REAL DATA CONNECTED. Account and community statistics are live. This PR preview cannot change real accounts, badges or published content."
          : "PREVIEW ONLY: real account data is not connected. No real admin, badge or content changes are sent to Supabase.",
        "sladmin-preview-explanation",
      ));
      recent.append(button("Reset preview changes", () => {
        if (confirm("Reset the changes saved in this preview on this device?"))
          api.reset();
      }));
    }
    grid.append(quick, recent);
    const warning = el("div", undefined, "sladmin-data-warning");
    warning.hidden = true;
    warning.setAttribute("role", "alert");
    host.append(warning, stats, grid);

    // A stalled API call must not block the entire dashboard forever.
    async function fetchWithTimeout(label, getValue) {
      let timeout;
      try {
        return await Promise.race([
          Promise.resolve().then(getValue),
          new Promise((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error(label + " request timed out.")), 12000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
    }
    const results = await Promise.allSettled([
      fetchWithTimeout("Accounts", () => api.users()),
      fetchWithTimeout("Admins", () => api.users("", 0, true)),
      fetchWithTimeout("Content", () => api.content()),
      fetchWithTimeout("Activity", () => api.activity()),
    ]);
    if (version !== request) return;
    const [users, admins, content, activity] = results;
    const sourceLabels = ["Student accounts", "Administrators", "Content", "Recent activity"];
    const failed = results
      .map((r, i) => r.status === "rejected"
        ? sourceLabels[i] + ": " + (r.reason?.message || "Unavailable")
        : null)
      .filter(Boolean);
    if (real) {
      metricValues[0].textContent = String(real.profiles);
      metricValues[1].textContent = String(real.admins);
      metricValues[2].textContent = String(real.registered);
      metricValues[3].textContent = String(real.social_posts);
    } else {
      metricValues[0].textContent =
        users.status === "fulfilled" ? String(users.value.total) : "Unavailable";
      metricValues[1].textContent =
        admins.status === "fulfilled" ? String(admins.value.total) : "Unavailable";
      metricValues[2].textContent = content.status === "fulfilled"
        ? String(content.value.filter(x => x?.draft?.kind === "card").length)
        : "Unavailable";
      metricValues[3].textContent = content.status === "fulfilled"
        ? String(content.value.filter(x => x?.revision && !x?.draft?.hidden).length)
        : "Unavailable";
    }
    recentItems.replaceChildren();
    if (activity.status === "fulfilled") {
      if (!activity.value.length)
        recentItems.append(el("p", "No changes recorded in this preview yet."));
      for (const a of activity.value.slice(0, 4))
        recentItems.append(el("p", a.action + " · " + a.target));
    } else {
      recentItems.append(el("p", "Activity data is unavailable right now."));
    }
    if (failed.length) {
      warning.hidden = false;
      warning.append(
        el("strong", "Some dashboard data could not load."),
        el("p", failed.join(" | ")),
        button("Retry overview", () => render(), "sladmin-primary"),
      );
    }
  }
  async function userList(host, version) {
    const toolbar = el("div", undefined, "sladmin-toolbar"),
      search = el("input");
    search.placeholder = "Search name or username";
    search.setAttribute("aria-label", "Search users");
    const list = el("div", undefined, "sladmin-list"),
      pager = el("div", undefined, "sladmin-pager");
    toolbar.append(search);
    if (api.connectedPreview) {
      host.append(el("p",
        "Live users · Administrator-only controls. Changes to permissions or verification badges take effect on StudyLab immediately after confirmation. Guest accounts cannot receive admin privileges.",
        "sladmin-preview-explanation"));
    } else if (api.readonlyLive) {
      host.append(el("p",
        "Live StudyLab users. Read-only preview: real account and badge changes are disabled.",
        "sladmin-preview-explanation"));
    } else if (api.preview && api.liveStatsError) {
      host.append(el("p",
        "Live data unavailable: " + api.liveStatsError + ". Showing preview accounts instead.",
        "sladmin-preview-explanation"));
    }
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
        if (u.id === info.user.id || u.guest) actions[2].disabled = true;
        if (u.guest) {
          actions[1].disabled = true;
          actions[1].title = "Sign up as a registered user before receiving verification";
          actions[2].title = "Guest profiles cannot become administrators";
        }
        const banAction = button(u.banned ? "Unban user" : "Ban user",
          () => moderationDialog(u, load), "sladmin-danger");
        if (u.guest || u.admin || u.id === info.user.id || api.readonlyLive) {
          banAction.disabled = true;
          banAction.title = u.admin ? "Administrators must have their admin role removed separately"
            : u.guest ? "Guest accounts cannot be banned by this tool"
            : "This account cannot be banned";
        }
        actions.push(banAction);
        if (api.readonlyLive) {
          actions[1].disabled = true;
          actions[2].disabled = true;
          actions[1].title = "Read-only preview: real badges cannot be changed";
          actions[2].title = "Read-only preview: administrator access cannot be changed";
        }
        list.append(
          row(
            u.display_name || "Student",
            "@" +
              (u.username || "—") +
              (u.admin ? " · Admin" : "") +
              (u.verified ? " · Verified" : "") +
              (u.guest ? " · Guest" : "") +
              (u.banned ? " · BANNED" : ""),
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
    dialog.className = "sladmin-dialog";
    const head = el("header");
    head.append(
      el("h2", u.display_name || "Student"),
      button("Close", () => dialog.close()),
    );
    dialog.append(head);
    const dl = el("dl", undefined, "sladmin-user-detail");
    for (const [key, value] of [
      ["Username", "@" + (u.username || "—")],
      ["School", u.school || "Not provided"],
      ["Bio", u.bio || "Not provided"],
      ["Account", u.admin ? "Administrator" : u.guest ? "Guest profile" : "Registered student"],
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
      toolbar = el("div", undefined, "sladmin-toolbar"),
      search = el("input"),
      filter = el("select"),
      list = el("div", undefined, "sladmin-list");
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
        "sladmin-primary",
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
              ...((sectionMode && r.builtin) ? [] : [
                button("Delete", async () => {
                  const warning = sectionMode
                    ? "Delete the extra section \"" + d.title +
                      "\" and all its added cards permanently?"
                    : "Delete \"" + d.title +
                      "\" from StudyLab? Its saved draft and published entry will be removed.";
                  if (!confirm(warning)) return;
                  if (!confirm("Confirm permanent deletion. This cannot be undone from the dashboard.")) return;
                  const result = await api.deleteContent(r);
                  await render();
                  status("Deleted " + d.title +
                    (result?.deleted_children ? " and " + result.deleted_children + " linked cards." : "."));
                }, "sladmin-danger"),
              ]),
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
      wrap.className = "sladmin-wide";
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
    $("#sladmin-editor-title").textContent = (record ? "Edit " : "New ") + d.kind;
    const fields = el("div", undefined, "sladmin-fields");
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
    $("#sladmin-fields").replaceChildren(fields);
    $("#sladmin-editor-status").textContent = "";
    $(".sladmin-editor-actions").hidden = false;
    setDirty(false);
    $("#sladmin-editor").showModal();
  }
  $("#sladmin-form").addEventListener("input", () => setDirty(true));
  function payload() {
    const form = $("#sladmin-form"),
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
  $("#sladmin-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter;
    const buttons = [...$(".sladmin-editor-actions").querySelectorAll("button")];
    buttons.forEach((x) => (x.disabled = true));
    try {
      const d = payload(),
        action = b?.value || "draft";
      if (api.connectedPreview && action === "publish" &&
          !confirm("Publish this resource to the REAL StudyLab database? This is not a local preview.")) return;
      await api.save(d, editing.revision, action);
      setDirty(false);
      $("#sladmin-editor").close();
      await render();
      status(
        api.preview
          ? "Saved in this preview on this device."
          : action === "publish"
            ? "Published successfully."
            : "Draft saved.",
      );
    } catch (err) {
      $("#sladmin-editor-status").textContent = err.message;
    } finally {
      buttons.forEach((x) => (x.disabled = false));
    }
  };
  $("#sladmin-preview").onclick = () => {
    try {
      const d = payload();
      localStorage.setItem(
        "studylab-admin-draft-preview",
        JSON.stringify({ owner: info.user.id, item: d }),
      );
      window.open(d.page + "?admin-preview=1", "_blank", "noopener");
    } catch (e) {
      $("#sladmin-editor-status").textContent = e.message;
    }
  };
  async function mediaList(host, version) {
    const toolbar = el("div", undefined, "sladmin-toolbar"),
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
    const grid = el("div", undefined, "sladmin-media-grid");
    host.append(grid);
    if (!entries.length)
      empty(
        grid,
        "Your uploaded images and learning resources will appear here.",
      );
    for (const m of entries) {
      const c = el("article", undefined, "sladmin-card");
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
    $("#sladmin-tabs").append(button(tab, () => navigate(tab)));
  (async () => {
    try {
      info = await api.init();
      $("#sladmin-gate").hidden = true;
      $("#sladmin-workspace").hidden = false;
      $("#sladmin-identity").textContent = "Administrator";
      $("#sladmin-mode").append(
        el("strong", api.connectedPreview ? "PR #102 · Live admin controls. "
          : api.preview ? "Preview workspace. " : "Live workspace. "),
        document.createTextNode(
          api.connectedPreview
            ? "Connected to the real StudyLab database. Granting rights, changing badges and publishing resources affect live data. Existing site layout remains on its deployed version until release."
            : api.readonlyLive
              ? "Connected securely to real StudyLab profiles and statistics. This preview is read-only."
              : api.preview
                ? "Sample content and changes stay on this device. No live database updates."
                : "Published edits are visible to students. Drafts stay private.",
        ),
      );
      $("#sladmin-mode").append(el(
        "small",
        api.connectedPreview ? "Connected admin preview · PR #102"
          : api.preview ? "Local preview · PR #102" : "StudyLab Admin · Live",
        "sladmin-build-label",
      ));
      await navigate("Overview");
    } catch (e) {

      $("#sladmin-workspace").hidden = true;
      $("#sladmin-gate").hidden = false;
      $("#sladmin-gate").textContent = e?.message || "Admin access could not be verified.";
      $("#sladmin-identity").textContent = "Access restricted";
    }
  })();
})();
