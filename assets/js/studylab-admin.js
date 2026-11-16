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
    overviewMidnightTimer = null,
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
  function quickIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.classList.add("sladmin-quick-icon");
    const shapes = {
      Content: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"],
      Users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z","M22 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"],
      Admins: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z","m9 12 2 2 4-4"],
      Sections: ["M3 3h7v7H3z","M14 3h7v7h-7z","M3 14h7v7H3z","M14 14h7v7h-7z"],
      Media: ["M3 3h18v18H3z","m3 15 4-4 3 3 3-3 5 5","M8.5 8.5h.01"],
      "Pop-up Messages": ["M21 11.5a8.38 8.38 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8.5Z"]
    };
    for (const d of shapes[name] || shapes.Content) {
      const p = document.createElementNS("http://www.w3.org/2000/svg","path");
      p.setAttribute("d",d);
      p.setAttribute("fill","none");
      p.setAttribute("stroke","currentColor");
      p.setAttribute("stroke-width","1.8");
      p.setAttribute("stroke-linecap","round");
      p.setAttribute("stroke-linejoin","round");
      svg.append(p);
    }
    return svg;
  }
  function colomboDate(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
  }
  function scheduleOverviewReset() {
    clearTimeout(overviewMidnightTimer);
    const localMillis = Date.now() + 330 * 60000;
    const until = 86400000 - (localMillis % 86400000);
    overviewMidnightTimer = setTimeout(() => {
      if (active === "Overview") render();
    }, until + 200);
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
    const toolbar = el("div", undefined, "sladmin-toolbar sladmin-history-actions");
    toolbar.append(el("span",
      "Clear hides a log entry. Undo reverses eligible unchanged actions.",
      "sladmin-history-info"));
    toolbar.append(button("Clear all", async () => {
      if (!confirm("Hide all activity from this dashboard? This will NOT undo any changes. The protected audit record stays in Supabase.")) return;
      await api.history("clear_all");
      await render();
      status("History cleared from the dashboard. Live changes remain.");
    }, "sladmin-history-clear sladmin-danger"));
    const list = el("div", undefined, "sladmin-list");
    host.append(toolbar, list);
    if (!entries.length) empty(list, "No visible history. New actions will appear here.");
    for (const a of entries) {
      const actions = [
        button("Clear", async () => {
          if (!confirm("Hide this history entry? The original change will remain.")) return;
          await api.history("clear", a.id);
          await render();
          status("History message cleared; nothing was reversed.");
        }),
        button("Undo", async () => {
          if (!confirm("Undo this eligible admin change on the LIVE StudyLab database? It will be reversed only if its target has not changed since.")) return;
          await api.history("undo", a.id);
          await render();
          status("Change undone. A new audit entry records the reversal.");
        }, "sladmin-undo"),
      ];
      if (!a.id) {
        actions[0].disabled = true;
        actions[0].title = "Older local log entries cannot be cleared individually";
      }
      if (!a.can_undo || a.undone_at) {
        actions[1].disabled = true;
        actions[1].title = a.undone_at
          ? "Already undone"
          : "No safe undo snapshot for this action";
      }
      list.append(row(
        a.action + (a.undone_at ? " · Undone" : ""),
        a.target + " · " + new Date(a.created_at).toLocaleString(),
        actions, "↻",
      ));
    }
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
      ["Learning resources", "Content"],
      ["Users & badges", "Users"],
      ["Admin access", "Admins"],
      ["Homepage sections", "Sections"],
      ["Media library", "Media"],
      ["Pop-up messages", "Pop-up Messages"],
    ]) {
      const action = button(title, () => navigate(tab), "sladmin-quick");
      action.append(quickIcon(tab));
      quick.append(action);
    }
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
      const today = colomboDate(new Date());
      const todays = activity.value.filter(a =>
        a.created_at && colomboDate(new Date(a.created_at)) === today);
      if (!todays.length)
        recentItems.append(el("p", "No activity today."));
      for (const a of todays.slice(0, 4))
        recentItems.append(el("p", a.action + " · " + a.target));
      scheduleOverviewReset();
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
  function textLabel(name, label, value, presets, limit) {
    const wrap = field(name, label, value || presets[0]);
    const input = wrap.querySelector("input");
    input.maxLength = limit;
    input.placeholder = presets[0];
    const list = el("datalist");
    list.id = "sladmin-label-" + name;
    input.setAttribute("list", list.id);
    for (const word of presets) {
      const option = el("option");
      option.value = word;
      list.append(option);
    }
    wrap.append(list);
    return wrap;
  }
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
        field("url", "Destination link (website, domain or internal path)", d.url),
        field("image", "Image URL (optional)", d.image),
        textLabel("button_label", "Card button · max 22 characters",
          d.button_label || "Open resource",
          ["Open resource","Open","Open link","View","Try","Learn more"],22),
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
      "button_label",
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
  function floatingPreview(item) {
    const popup = el("aside", undefined, "slpopup-toast slpopup-" + item.variant);
    popup.dataset.placement = item.placement;
    popup.setAttribute("role", "status");
    popup.append(el("strong", item.title), el("p", item.message));
    const close = button("×", () => popup.remove(), "slpopup-close");
    close.setAttribute("aria-label", "Close preview");
    popup.prepend(close);
    if (item.link) popup.append(el("span",
      item.link_label || "View", "slpopup-link slpopup-link-preview"));
    popup.append(el("small", "Admin preview · Not sent"));
    document.body.append(popup);
    setTimeout(() => popup.remove(), Number(item.display_seconds || 8) * 1000);
  }
  function popupEditor(record = null) {
    const dialog = el("dialog", undefined, "sladmin-dialog sladmin-popup-dialog");
    const form = el("form"), header = el("header"),
      fields = el("div", undefined, "sladmin-fields"),
      error = el("p", "", "sladmin-modal-error"),
      actions = el("div", undefined, "sladmin-editor-actions");
    const dismiss = () => { dialog.close(); dialog.remove(); };
    const close = button("×", dismiss);
    close.setAttribute("aria-label", "Close pop-up editor");
    header.append(el("h2", record ? "Edit pop-up message" : "New pop-up message"), close);
    const data = record || {};
    fields.append(
      field("title", "Title", data.title || ""),
      field("message", "Message", data.message || "", "textarea"),
      field("variant", "Style", data.variant || "info", "text", [
        ["info","Info · Blue"],["success","Success · Mint"],
        ["warning","Warning · Amber"],["important","Important · Purple"],
        ["custom","Custom · Multicolour"],
      ]),
      field("placement", "Position", data.placement || "top-right", "text", [
        ["top-right","Upper right"],["top-center","Upper middle"],
        ["center","Center screen"],["bottom-right","Lower right"],
      ]),
      field("display_seconds", "Display time (3–30 seconds)",
        data.display_seconds || 8,"number"),
      field("link", "Optional website link",data.link || ""),
      textLabel("link_label", "Link button · max 20 characters",
        data.link_label || "View",
        ["View","Open","Try","Read more","Learn more"],20),
    );
    fields.querySelector('[name="title"]').maxLength = 120;
    fields.querySelector('[name="message"]').maxLength = 800;
    const duration = fields.querySelector('[name="display_seconds"]');
    duration.min = "3"; duration.max = "30";
    const messageLabel = fields.querySelector('[name="message"]').closest("label");
    messageLabel.classList.add("sladmin-wide");
    if (!record) {
      const schedule = field("starts_at", "Schedule time (optional)", "", "datetime-local");
      schedule.classList.add("sladmin-wide");
      fields.append(schedule);
    } else {
      fields.append(el("p", "This message keeps its original 24-hour expiry. People who saw it will not see it again.", "sladmin-muted"));
    }
    const readForm = () => {
      const fd = new FormData(form);
      const start = fd.get("starts_at");
      const starts_at = record?.starts_at ||
        (start ? new Date(String(start)).toISOString() : new Date().toISOString());
      const item = {
        id: record?.id || null,
        title: String(fd.get("title") || "").trim(),
        message: String(fd.get("message") || "").trim(),
        variant: String(fd.get("variant") || "info"),
        placement: String(fd.get("placement") || "top-right"),
        display_seconds: Number(fd.get("display_seconds") || 8),
        link: String(fd.get("link") || "").trim(),
        link_label: String(fd.get("link_label") || "View").trim(),
        starts_at,
      };
      if (!item.title || !item.message || item.title.length>120 ||
          item.message.length>800 || !Number.isInteger(item.display_seconds) ||
          item.display_seconds<3 || item.display_seconds>30 ||
          !item.link_label || item.link_label.length>20 ||
          /[\u0000-\u001f<>]/.test(item.link_label) ||
          !Number.isFinite(new Date(item.starts_at).getTime()))
        throw Error("Enter valid text, a display time and schedule.");
      if (item.link) item.link = api.safeURL(item.link);
      return item;
    };
    actions.append(
      button("Preview", () => {
        try { floatingPreview(readForm()); error.textContent = ""; }
        catch (e) { error.textContent = e.message; }
      }),
      button("Cancel", dismiss),
    );
    const send = el("button", record ? "Save changes" : "Send / Schedule", "sladmin-primary");
    send.type = "submit"; actions.append(send);
    form.append(header,fields,error,actions);
    form.onsubmit = async (event) => {
      event.preventDefault(); send.disabled = true;
      try {
        const item = readForm();
        if (!record && !confirm(
          "Send this pop-up to StudyLab visitors for 24 hours after its scheduled start?")) return;
        await api.popupSet(record ? "update" : "create", item);
        dismiss();
        await render();
        status(record ? "Message updated. Existing viewers will not see it twice."
          : "Message scheduled/published for one-time delivery within 24 hours.");
      } catch (e) { error.textContent = e.message || "Couldn't save the message."; }
      finally { send.disabled = false; }
    };
    dialog.append(form); document.body.append(dialog); dialog.showModal();
  }
  async function popupList(host, version) {
    const toolbar = el("div", undefined, "sladmin-toolbar"),
      list = el("div", undefined, "sladmin-list");
    toolbar.append(button("+ New pop-up", () => popupEditor(), "sladmin-primary"));
    host.append(el("p",
      "Each message is eligible for exactly 24 hours after its scheduled start. A signed-in student sees it once across devices; visitors without accounts are tracked on this device.",
      "sladmin-preview-explanation"), toolbar, list);
    const rows = await api.popups();
    if (version !== request) return;
    if (!rows.length) empty(list, "No pop-up messages. Create an announcement above.");
    for (const p of rows) {
      const now = Date.now(), begin = new Date(p.starts_at).getTime();
      const end = begin + 86400000;
      const state = now < begin ? "Scheduled" : now >= end ? "Expired" : "Active";
      list.append(row(p.title,
        state + " · " + p.variant + " · " + p.placement +
          " · " + p.display_seconds + " sec · Expires " +
          new Date(end).toLocaleString() +
          " · Seen by " + (p.delivered || 0) + " accounts",
        [
          button("Preview", () => floatingPreview(p)),
          button("Edit", () => popupEditor(p)),
          button("Delete", async () => {
            if (!confirm("Delete pop-up \"" + p.title +
              "\" permanently, including its delivery receipts?")) return;
            await api.popupSet("delete", { id: p.id });
            await render();
          }, "sladmin-danger"),
        ],"✉"));
    }
  }
  function moderationDialog(u, refresh) {
    if (u.admin || u.guest || u.id === info.user.id) return;
    const unban = Boolean(u.banned);
    const dialog = el("dialog", undefined, "sladmin-dialog sladmin-moderation-dialog"),
      form = el("form"),
      header = el("header"),
      fields = el("div", undefined, "sladmin-fields"),
      error = el("p", "", "sladmin-modal-error"),
      actions = el("div", undefined, "sladmin-editor-actions");
    const dismiss = () => { dialog.close(); dialog.remove(); };
    header.append(el("h2", (unban ? "Unban " : "Ban ") +
      (u.display_name || "student")), button("×", dismiss));
    form.append(header,el("p",
      unban ? "This will restore sign-in access for this account."
        : "This bans the account from signing in again with the same Google identity. Previously issued access tokens may persist briefly.",
      "sladmin-muted"));
    if (!unban) {
      fields.append(field("hours", "Duration", "24", "text", [
        ["24", "24 hours"],["168", "7 days"],["720", "30 days"],
        ["876000", "Indefinite (until unbanned)"],
      ]));
      const reason = field("reason", "Moderation reason (3–500 characters)","", "textarea");
      reason.classList.add("sladmin-wide");
      reason.querySelector("textarea").maxLength=500;
      fields.append(reason);
    }
    actions.append(button("Cancel", dismiss));
    const submit = el("button",unban ? "Confirm unban" : "Confirm ban",
      unban ? "sladmin-primary" : "sladmin-danger");
    submit.type="submit"; actions.append(submit);
    form.append(fields,error,actions);
    form.onsubmit=async (e)=>{
      e.preventDefault(); submit.disabled=true;
      try {
        const data=new FormData(form);
        const hours=unban ? 0 : Number(data.get("hours"));
        const reason=unban ? "" : String(data.get("reason")||"").trim();
        if (!unban && reason.length<3) throw Error("Enter a moderation reason.");
        if (!confirm(unban ? "Confirm restoring this student's sign-in access?"
          : "Confirm REAL account ban? This affects the student's StudyLab login.")) return;
        await api.banUser(u.id,hours,reason);
        dismiss(); await refresh();
        status(unban ? "Account unbanned." : "Account ban saved.");
      } catch (err) { error.textContent=err.message || "Moderation failed."; }
      finally { submit.disabled=false; }
    };
    dialog.append(form);document.body.append(dialog);dialog.showModal();
  }
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
      // The connected-status notice is redundant once access is verified.
      // Keep its text for diagnostics, but not a permanent on-screen card.
      $("#sladmin-mode").hidden = true;
      await navigate("Overview");
    } catch (e) {

      $("#sladmin-workspace").hidden = true;
      $("#sladmin-gate").hidden = false;
      $("#sladmin-gate").textContent = e?.message || "Admin access could not be verified.";
      $("#sladmin-identity").textContent = "Access restricted";
    }
  })();
})();
