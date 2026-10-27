/*
 * Study-Lab personal study dashboard
 *
 * Browser-local student dashboard:
 * - Quick Find search
 * - Favorites
 * - Recently opened
 * - Unique tools explored progress
 * - Floating Quick Access panel
 *
 * Favorites and progress are stored in this browser's localStorage.
 */
(function () {
  "use strict";

  const MAX_RECENT = 8;
  const subject = (document.body.dataset.filterSubject || "").trim().toLowerCase();

  const SELECTORS = {
    toolGrid: ".tool-grid",
    subjectGrid: ".card-grid"
  };

  /*
   * localStorage is the source of truth for dashboard data.
   * A one-time read of old cloud rows is attempted while the legacy
   * tables still exist, so returning students can keep their saved items.
   */
  const cloud = {
    client: null,
    userId: null,
    ready: false,
    error: null,
    favorites: new Map(),
    progress: new Map()
  };

  function getCloudAccount() {
    return window.StudyLabAccount || null;
  }

  function getFavorites() {
    return [...cloud.favorites.keys()];
  }

  function getFavoriteMetaStore() {
    const store = {};
    cloud.favorites.forEach((value, url) => {
      store[url] = {
        title: value.title || "",
        description: value.description || "",
        subject: value.subject || "study-lab"
      };
    });
    return store;
  }

  function getRecent() {
    return [...cloud.progress.values()]
      .sort((a, b) => {
        return new Date(b.last_opened_at || 0) - new Date(a.last_opened_at || 0);
      })
      .slice(0, MAX_RECENT)
      .map(item => ({
        url: item.tool_url,
        title: item.title || "Untitled tool",
        description: item.description || "",
        subject: item.subject || "study-lab",
        savedAt: new Date(item.last_opened_at || 0).getTime()
      }));
  }

  function getExplored() {
    return [...cloud.progress.values()].map(item => ({
      url: item.tool_url,
      title: item.title || "Untitled tool",
      description: item.description || "",
      subject: item.subject || "study-lab",
      savedAt: new Date(item.last_opened_at || 0).getTime()
    }));
  }

  const LOCAL_KEYS = {
    favorites: "studyLabFavorites",
    favoriteMeta: "studyLabFavoriteMeta",
    explored: "studyLabExploredTools",
    recent: "studyLabRecent",
    migrated: "studyLabLocalDashboardV1"
  };

  function readLocalJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("StudyLab local dashboard storage:", error);
      return false;
    }
  }

  function persistDashboardLocal() {
    const favorites = [...cloud.favorites.keys()];
    const favoriteMeta = {};
    cloud.favorites.forEach((row, url) => {
      favoriteMeta[url] = {
        title: row.title || "",
        description: row.description || "",
        subject: row.subject || "study-lab"
      };
    });
    const explored = [...cloud.progress.values()].map(row => ({
      url: row.tool_url,
      title: row.title || "Untitled tool",
      description: row.description || "",
      subject: row.subject || "study-lab",
      savedAt: new Date(row.last_opened_at || Date.now()).getTime(),
      firstOpenedAt: row.first_opened_at || row.last_opened_at || new Date().toISOString(),
      openCount: Number(row.open_count) || 1
    }));
    const recent = [...explored]
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_RECENT);

    writeLocalJson(LOCAL_KEYS.favorites, favorites);
    writeLocalJson(LOCAL_KEYS.favoriteMeta, favoriteMeta);
    writeLocalJson(LOCAL_KEYS.explored, explored);
    writeLocalJson(LOCAL_KEYS.recent, recent);
  }

  async function loadCloudDashboard() {
    const oldFavorites = readLocalJson(LOCAL_KEYS.favorites, []);
    const oldMeta = readLocalJson(LOCAL_KEYS.favoriteMeta, {});
    const oldExplored = readLocalJson(LOCAL_KEYS.explored, []);
    const oldRecent = readLocalJson(LOCAL_KEYS.recent, []);
    const favorites = new Map();
    const progress = new Map();

    (Array.isArray(oldFavorites) ? oldFavorites : []).forEach(item => {
      const url = typeof item === "string" ? item : item?.url;
      if (!url) return;
      const meta = oldMeta && typeof oldMeta === "object" ? (oldMeta[url] || {}) : {};
      favorites.set(url, {
        tool_url: url,
        title: meta.title || item?.title || "",
        description: meta.description || item?.description || "",
        subject: meta.subject || item?.subject || "study-lab"
      });
    });

    [...(Array.isArray(oldExplored) ? oldExplored : []), ...(Array.isArray(oldRecent) ? oldRecent : [])]
      .forEach(item => {
        if (!item?.url) return;
        const stamp = Number(item.savedAt) || Date.now();
        const existing = progress.get(item.url);
        progress.set(item.url, {
          tool_url: item.url,
          title: item.title || existing?.title || "Untitled tool",
          description: item.description || existing?.description || "",
          subject: item.subject || existing?.subject || "study-lab",
          first_opened_at: item.firstOpenedAt || existing?.first_opened_at || new Date(stamp).toISOString(),
          last_opened_at: new Date(Math.max(stamp, new Date(existing?.last_opened_at || 0).getTime())).toISOString(),
          open_count: Math.max(Number(item.openCount) || 1, Number(existing?.open_count) || 0)
        });
      });

    // One-time migration: read existing cloud records, never write dashboard data to Supabase.
    let account = getCloudAccount();
    let migrationSucceeded = false;
    if ((() => { try { return localStorage.getItem(LOCAL_KEYS.migrated) !== "1"; } catch (_) { return true; } })() && account?.ready) {
      try {
        await account.ready;
        const client = account.client;
        const user = account.getUser?.();
        if (client && user?.id) {
          const [favResult, progressResult] = await Promise.all([
            client.from("studylab_favorites")
              .select("tool_url,title,description,subject,created_at")
              .eq("user_id", user.id),
            client.from("studylab_progress")
              .select("tool_url,title,subject,first_opened_at,last_opened_at,open_count")
              .eq("user_id", user.id)
          ]);
          if (!favResult.error) {
            (favResult.data || []).forEach(row => {
              if (!favorites.has(row.tool_url)) favorites.set(row.tool_url, row);
            });
          }
          if (!progressResult.error) {
            (progressResult.data || []).forEach(row => {
              const existing = progress.get(row.tool_url);
              progress.set(row.tool_url, {
                ...row,
                description: existing?.description || "",
                first_opened_at: existing?.first_opened_at || row.first_opened_at,
                last_opened_at: new Date(Math.max(
                  new Date(existing?.last_opened_at || 0).getTime(),
                  new Date(row.last_opened_at || 0).getTime()
                )).toISOString(),
                open_count: Math.max(Number(existing?.open_count) || 0, Number(row.open_count) || 1)
              });
            });
          }
          migrationSucceeded = !favResult.error && !progressResult.error;
        }
      } catch (error) {
        // Tables may already have been removed; local dashboard remains usable.
        console.info("StudyLab local dashboard migration skipped:", error?.message || error);
      }
    }

    cloud.favorites = favorites;
    cloud.progress = progress;
    cloud.client = null;
    cloud.userId = null;
    cloud.ready = true;
    cloud.error = null;
    if (migrationSucceeded) {
      try { localStorage.setItem(LOCAL_KEYS.migrated, "1"); } catch (_) {}
    }
    persistDashboardLocal();
  }

  async function saveFavoriteCloud(card) {
    const meta = buildMeta(card, card.dataset.studySubject || subject);
    cloud.favorites.set(meta.url, {
      tool_url: meta.url,
      title: meta.title,
      description: meta.description,
      subject: meta.subject
    });
    persistDashboardLocal();
  }

  async function deleteFavoriteCloud(url) {
    cloud.favorites.delete(url);
    persistDashboardLocal();
  }

  async function saveProgressCloud(meta) {
    if (!meta?.url) return;
    const existing = cloud.progress.get(meta.url);
    const now = new Date().toISOString();
    cloud.progress.set(meta.url, {
      ...(existing || {}),
      tool_url: meta.url,
      title: meta.title || existing?.title || "Untitled tool",
      description: meta.description || existing?.description || "",
      subject: meta.subject || existing?.subject || "study-lab",
      first_opened_at: existing?.first_opened_at || now,
      last_opened_at: now,
      open_count: Number(existing?.open_count || 0) || 1
    });
    persistDashboardLocal();
  }

  function getCardUrl(card) {
    return card.getAttribute("href") || card.href || "";
  }

  function getCardTitle(card) {
    const heading = card.querySelector("h2, h3");
    return heading?.textContent.replace(/\s+/g, " ").trim() || "Untitled tool";
  }

  function getCardDescription(card) {
    const p = card.querySelector("p");
    return p?.textContent.replace(/\s+/g, " ").trim() || "";
  }

  function getCardSearchText(card) {
    return (
      card.textContent.replace(/\s+/g, " ") +
      " " +
      getCardUrl(card)
    ).toLowerCase();
  }

  function subjectLabel(value) {
    const labels = {
      maths: "Mathematics",
      biology: "Biology",
      chemistry: "Chemistry",
      physics: "Physics"
    };
    return labels[value] || "Study-Lab";
  }

  function isToolCard(card) {
    return card.matches(".tool-card") && !!getCardUrl(card);
  }

  function buildMeta(card, knownSubject) {
    return {
      url: card.href,
      title: getCardTitle(card),
      description: getCardDescription(card),
      subject: knownSubject || subject || "study-lab",
      savedAt: Date.now()
    };
  }

  function favoriteSet() {
    return new Set(getFavorites());
  }

  function isFavorite(card) {
    return favoriteSet().has(card.href);
  }

  function updateFavoriteButton(card, button) {
    const active = isFavorite(card);
    button.classList.toggle("is-favorite", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      active ? "Remove from favorites" : "Add to favorites"
    );
  }

  function toggleFavorite(card) {
    const url = card.href;
    const wasFavorite = cloud.favorites.has(url);

    if (!cloud.ready) {
      return;
    }

    if (wasFavorite) {
      cloud.favorites.delete(url);
      updateFavoriteButton(
        card,
        card.querySelector(".study-favorite-toggle")
      );

      deleteFavoriteCloud(url).catch(error => {
        console.warn("StudyLab favorite removal:", error);
        cloud.favorites.set(url, {
          tool_url: url,
          title: getCardTitle(card),
          description: getCardDescription(card),
          subject: card.dataset.studySubject || subject || "study-lab"
        });
        updateFavoriteButton(card, card.querySelector(".study-favorite-toggle"));
      });
    } else {
      const meta = buildMeta(card, card.dataset.studySubject || subject);
      cloud.favorites.set(url, {
        tool_url: meta.url,
        title: meta.title,
        description: meta.description,
        subject: meta.subject
      });
      updateFavoriteButton(
        card,
        card.querySelector(".study-favorite-toggle")
      );

      saveFavoriteCloud(card).catch(error => {
        console.warn("StudyLab favorite save:", error);
        cloud.favorites.delete(url);
        updateFavoriteButton(card, card.querySelector(".study-favorite-toggle"));
      });
    }

    refreshQuickPanel();
    refreshSearchMeta();
  }

  function enhanceCard(card, knownSubject) {
    if (!isToolCard(card) || card.dataset.studyEnhanced === "true") return;

    card.dataset.studyEnhanced = "true";
    card.dataset.studySubject = knownSubject || subject || "study-lab";

    const favorite = document.createElement("span");
    favorite.className = "study-favorite-toggle";
    favorite.setAttribute("role", "button");
    favorite.setAttribute("tabindex", "0");
    favorite.setAttribute("aria-pressed", "false");

    favorite.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(card);
    });

    favorite.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(card);
      }
    });

    card.appendChild(favorite);
    updateFavoriteButton(card, favorite);
  }

  function enhanceVisibleCards() {
    document.querySelectorAll(".tool-card").forEach(card => {
      enhanceCard(card, subject || "");
    });

    document.querySelectorAll(".subject-card").forEach(card => {
      // Homepage subject cards are searchable, but are not favoritable study tools.
      card.dataset.studySubject = card.getAttribute("href")
        ?.replace(/\.html$/i, "")
        .split("/")
        .pop()
        ?.toLowerCase() || "";
    });
  }

  function recordMeta(meta) {
    if (!meta?.url || !cloud.ready) return;

    const existing = cloud.progress.get(meta.url);
    const now = new Date().toISOString();

    cloud.progress.set(meta.url, {
      ...(existing || {}),
      user_id: cloud.userId,
      tool_url: meta.url,
      title: meta.title || existing?.title || "Untitled tool",
      subject: meta.subject || existing?.subject || "study-lab",
      first_opened_at: existing?.first_opened_at || now,
      last_opened_at: now,
      open_count: (existing?.open_count || 0) + 1
    });

    refreshQuickPanel();
    refreshProgress();

    saveProgressCloud(meta).catch(error => {
      console.warn("StudyLab progress save:", error);
    });
  }

  function recordOpen(card) {
    const meta = buildMeta(card, card.dataset.studySubject || subject);
    recordMeta(meta);
  }

  function attachOpenTracking(card) {
    if (!isToolCard(card) || card.dataset.studyTracked === "true") return;
    card.dataset.studyTracked = "true";

    card.addEventListener("click", event => {
      if (event.target.closest(".study-favorite-toggle")) return;
      recordOpen(card);
    });
  }

  let searchInput = null;
  let searchMeta = null;
  let searchClear = null;

  function currentSearchCards() {
    const toolGrid = document.querySelector(SELECTORS.toolGrid);
    if (toolGrid) {
      return [...toolGrid.querySelectorAll(":scope > .tool-card")];
    }

    const subjectGrid = document.querySelector(SELECTORS.subjectGrid);
    if (subjectGrid) {
      return [...subjectGrid.querySelectorAll(":scope > .subject-card")];
    }

    return [];
  }

  function applySearch() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const cards = currentSearchCards();
    let matches = 0;

    cards.forEach(card => {
      const matched = !query || getCardSearchText(card).includes(query);

      if (matched) {
        card.classList.remove("study-search-hidden");
        matches += 1;
      } else {
        card.classList.add("study-search-hidden");
      }
    });

    if (searchMeta) {
      const label = document.querySelector(SELECTORS.toolGrid)
        ? "tools"
        : "subjects";
      searchMeta.textContent = query
        ? matches + " " + label + " found"
        : cards.length + " " + label;
    }

    if (searchClear) {
      searchClear.hidden = !query;
    }
  }

  function clearSearch() {
    if (!searchInput) return;
    searchInput.value = "";
    applySearch();
    searchInput.focus();
  }

  function focusSearch() {
    const target = searchInput || document.querySelector("#studyQuickSearch");
    if (target) {
      target.focus();
      target.select?.();
      return true;
    }
    return false;
  }

  function createSearchBar() {
    const toolGrid = document.querySelector(SELECTORS.toolGrid);
    const subjectGrid = document.querySelector(SELECTORS.subjectGrid);
    const targetGrid = toolGrid || subjectGrid;

    if (!targetGrid || document.querySelector(".study-findbar")) return;

    const wrap = document.createElement("div");
    wrap.className = "study-findbar";
    wrap.setAttribute("role", "search");

    const icon = document.createElement("span");
    icon.className = "study-find-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⌕";

    searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "study-find-input";
    searchInput.id = "studyQuickSearch";
    searchInput.autocomplete = "off";
    searchInput.spellcheck = false;
    searchInput.placeholder = toolGrid
      ? "Search tools, lessons, topics..."
      : "Search subjects...";
    searchInput.setAttribute("aria-label", searchInput.placeholder);

    searchClear = document.createElement("button");
    searchClear.type = "button";
    searchClear.className = "study-find-clear";
    searchClear.setAttribute("aria-label", "Clear search");
    searchClear.textContent = "×";
    searchClear.hidden = true;
    searchClear.addEventListener("click", clearSearch);

    searchMeta = document.createElement("span");
    searchMeta.className = "study-find-meta";

    searchInput.addEventListener("input", applySearch);

    wrap.append(icon, searchInput, searchClear, searchMeta);

    if (toolGrid) {
      const filter = document.getElementById("lessonFilter");
      if (filter) {
        filter.parentNode.insertBefore(wrap, filter);
      } else {
        targetGrid.parentNode.insertBefore(wrap, targetGrid);
      }
    } else {
      targetGrid.parentNode.insertBefore(wrap, targetGrid);
    }

    applySearch();
  }

  function ensureProgress() {
    const toolGrid = document.querySelector(SELECTORS.toolGrid);
    if (!toolGrid || document.querySelector(".study-progress")) return;

    const row = document.createElement("div");
    row.className = "study-progress";
    row.setAttribute("aria-live", "polite");

    const label = document.createElement("span");
    label.className = "study-progress-label";

    const track = document.createElement("span");
    track.className = "study-progress-track";

    const bar = document.createElement("span");
    bar.className = "study-progress-bar";
    track.appendChild(bar);

    const value = document.createElement("span");
    value.className = "study-progress-value";

    row.append(label, track, value);

    const findbar = document.querySelector(".study-findbar");
    const filter = document.getElementById("lessonFilter");

    if (findbar) {
      findbar.insertAdjacentElement("afterend", row);
    } else if (filter) {
      filter.insertAdjacentElement("beforebegin", row);
    } else {
      toolGrid.parentNode.insertBefore(row, toolGrid);
    }
  }

  function refreshProgress() {
    const row = document.querySelector(".study-progress");
    if (!row) return;

    const toolGrid = document.querySelector(SELECTORS.toolGrid);
    if (!toolGrid) return;

    const total = toolGrid.querySelectorAll(":scope > .tool-card").length;
    const relevantSubject = subject || "";

    const exploredCount = new Set(
      getExplored()
        .filter(item => !relevantSubject || item.subject === relevantSubject)
        .map(item => item.url)
    ).size;

    const safeCount = Math.min(exploredCount, total);
    const percent = total ? Math.round((safeCount / total) * 100) : 0;

    const label = row.querySelector(".study-progress-label");
    const bar = row.querySelector(".study-progress-bar");
    const value = row.querySelector(".study-progress-value");

    if (label) {
      label.textContent = relevantSubject
        ? subjectLabel(relevantSubject) + " progress"
        : "Study progress";
    }
    if (value) {
      value.textContent = safeCount + " / " + total + " explored";
    }
    if (bar) {
      bar.style.width = percent + "%";
    }
  }

  function createQuickAccess() {
    // Quick Access belongs on study resource pages, not the Live Study Room.
    // The room uses the Chat launcher in this floating-control area instead.
    if (document.body.classList.contains("study-room-page")) return;
    if (document.getElementById("studyQuickAccess")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "study-quick-button";
    button.id = "studyQuickButton";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "studyQuickAccessPanel");
    button.innerHTML =
      '<span class="study-quick-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M13.2 2.5 5.8 13h5l-.7 8.5L18.2 11h-5.1l.1-8.5Z"/></svg></span><span>Quick</span>';

    const panel = document.createElement("aside");
    panel.className = "study-quick-panel";
    panel.id = "studyQuickAccessPanel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Study-Lab Quick Access");

    panel.innerHTML = `
      <div class="study-quick-head">
        <div>
          <strong>Quick Access</strong>
          <small>Synced to your StudyLab account</small>
        </div>
        <button type="button" class="study-quick-close" aria-label="Close Quick Access">×</button>
      </div>

      <div class="study-quick-search-row">
        <span aria-hidden="true">⌕</span>
        <input
          id="studyQuickSearchPanel"
          class="study-quick-search"
          type="search"
          autocomplete="off"
          placeholder="Search..."
          aria-label="Quick search"
        />
      </div>

      <div class="study-quick-progress">
        <div class="study-quick-progress-top">
          <span>📊 Progress</span>
          <strong id="studyQuickProgressValue">0 tools explored</strong>
        </div>
        <div class="study-quick-progress-track">
          <span id="studyQuickProgressBar"></span>
        </div>
      </div>

      <section class="study-quick-section">
        <div class="study-quick-section-title">⭐ Favorites <span id="studyFavoriteCount">0</span></div>
        <div id="studyFavoriteList" class="study-quick-list"></div>
      </section>

      <section class="study-quick-section">
        <div class="study-quick-section-title">🕒 Recently Opened</div>
        <div id="studyRecentList" class="study-quick-list"></div>
      </section>
    `;

    document.body.append(button, panel);

    const close = panel.querySelector(".study-quick-close");
    const panelSearch = panel.querySelector("#studyQuickSearchPanel");

    function setOpen(open) {
      if (open) {
        window.dispatchEvent(new Event("studylab-quick-open"));
      }

      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      button.classList.toggle("is-open", open);

      if (open) {
        refreshQuickPanel();
        requestAnimationFrame(() => panelSearch.focus());
      }
    }

    button.addEventListener("click", event => {
      event.stopPropagation();
      setOpen(panel.hidden);
    });

    close.addEventListener("click", () => setOpen(false));

    panel.addEventListener("click", event => event.stopPropagation());

    panelSearch.addEventListener("input", () => {
      if (searchInput) {
        searchInput.value = panelSearch.value;
        applySearch();
      } else {
        searchInput = panelSearch;
      }
    });

    document.addEventListener("click", event => {
      if (!panel.hidden && !panel.contains(event.target) && event.target !== button && !button.contains(event.target)) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (!panel.hidden) {
          setOpen(false);
        } else if (document.activeElement === searchInput) {
          searchInput.blur();
        }
      }

      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        focusSearch();
      }
    });
  }

  function makeQuickItem(item, type) {
    const a = document.createElement("a");
    a.className = "study-quick-item";
    a.href = item.url;

    const icon = document.createElement("span");
    icon.className = "study-quick-item-icon";
    icon.textContent = type === "favorite" ? "★" : "↗";

    const text = document.createElement("span");
    text.className = "study-quick-item-text";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const meta = document.createElement("small");
    meta.textContent = subjectLabel(item.subject);

    text.append(title, meta);
    a.append(icon, text);

    a.addEventListener("click", () => {
      recordMeta({
        ...item,
        savedAt: Date.now()
      });
    });

    return a;
  }

  function refreshQuickPanel() {
    const panel = document.getElementById("studyQuickAccessPanel");
    if (!panel) return;

    const favorites = getFavorites();
    const recent = getRecent();

    const favoriteList = panel.querySelector("#studyFavoriteList");
    const recentList = panel.querySelector("#studyRecentList");
    const favoriteCount = panel.querySelector("#studyFavoriteCount");

    if (favoriteCount) favoriteCount.textContent = String(favorites.length);

    if (favoriteList) {
      favoriteList.innerHTML = "";

      const favoriteEntries = favorites
        .map(url => {
          const currentCard = [...document.querySelectorAll(".tool-card")]
            .find(card => card.href === url);

          if (currentCard) {
            return buildMeta(
              currentCard,
              currentCard.dataset.studySubject || subject
            );
          }

          const stored = getFavoriteMetaStore()[url];
          return stored?.title
            ? {
                url,
                title: stored.title,
                description: stored.description || "",
                subject: stored.subject || subject || "study-lab",
                savedAt: 0
              }
            : null;
        })
        .filter(Boolean)
        .slice(0, 8);

      if (!favoriteEntries.length) {
        favoriteList.innerHTML = '<div class="study-quick-empty">No favorites yet.</div>';
      } else {
        favoriteEntries.forEach(item => {
          favoriteList.appendChild(makeQuickItem(item, "favorite"));
        });
      }
    }

    if (recentList) {
      recentList.innerHTML = "";

      if (!recent.length) {
        recentList.innerHTML = '<div class="study-quick-empty">No tools opened yet.</div>';
      } else {
        recent.slice(0, MAX_RECENT).forEach(item => {
          recentList.appendChild(makeQuickItem(item, "recent"));
        });
      }
    }

    const progressValue = panel.querySelector("#studyQuickProgressValue");
    const progressBar = panel.querySelector("#studyQuickProgressBar");
    const explored = getExplored();
    const currentTotal =
      document.querySelector(SELECTORS.toolGrid)
        ?.querySelectorAll(":scope > .tool-card").length || 0;

    const currentExplored = subject
      ? new Set(
          explored
            .filter(item => item.subject === subject)
            .map(item => item.url)
        ).size
      : explored.length;

    if (progressValue) {
      progressValue.textContent = subject
        ? currentExplored + " / " + currentTotal + " explored"
        : explored.length + " tools explored";
    }

    if (progressBar) {
      const percent =
        subject && currentTotal
          ? Math.round(
              Math.min(currentExplored, currentTotal) /
              currentTotal *
              100
            )
          : 0;

      progressBar.style.width = percent + "%";
    }
  }

  function refreshSearchMeta() {
    if (searchInput) applySearch();
  }

  function setupCardObservers() {
    const grids = [...document.querySelectorAll(".tool-grid, .card-grid")];
    if (!grids.length) return;

    grids.forEach(grid => {
      enhanceVisibleCards();

      const observer = new MutationObserver(() => {
        enhanceVisibleCards();
        [...grid.querySelectorAll(":scope > .tool-card")].forEach(card => {
          attachOpenTracking(card);
        });
        refreshProgress();
        refreshSearchMeta();
      });

      observer.observe(grid, {
        childList: true,
        subtree: true
      });
    });
  }

  async function boot() {
    try {
      await loadCloudDashboard();
    } catch (error) {
      cloud.error = error;
      console.warn("StudyLab cloud dashboard:", error);

      const statusTargets = document.querySelectorAll(
        ".study-progress-label, .study-quick-progress-top strong"
      );
      statusTargets.forEach(node => {
        if (node && !node.textContent.includes("cloud")) {
          // Keep the existing dashboard usable while backend setup is completed.
        }
      });
    }

    createSearchBar();
    ensureProgress();
    enhanceVisibleCards();

    document.querySelectorAll(".tool-card").forEach(card => {
      attachOpenTracking(card);
    });

    refreshProgress();
    createQuickAccess();
    refreshQuickPanel();
    setupCardObservers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
