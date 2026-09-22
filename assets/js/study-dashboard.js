/*
 * Study-Lab personal study dashboard
 *
 * Cloud-backed student dashboard:
 * - Quick Find search
 * - Favorites
 * - Recently opened
 * - Unique tools explored progress
 * - Floating Quick Access panel
 *
 * Supabase is the source of truth for student dashboard data.
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
   * Supabase is now the source of truth for:
   * - favorites
   * - explored-tool progress
   * - recently opened (derived from progress)
   *
   * Old localStorage data is migrated once after the cloud
   * student account is ready, then the old app-data keys are removed.
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

  async function migrateLocalDashboardData(client, userId) {
    try {
      const oldFavorites = (() => {
        try {
          const raw = localStorage.getItem("studyLabFavorites");
          const value = raw ? JSON.parse(raw) : [];
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      })();

      const oldMeta = (() => {
        try {
          const raw = localStorage.getItem("studyLabFavoriteMeta");
          const value = raw ? JSON.parse(raw) : {};
          return value && typeof value === "object" && !Array.isArray(value) ? value : {};
        } catch {
          return {};
        }
      })();

      const oldExplored = (() => {
        try {
          const raw = localStorage.getItem("studyLabExploredTools");
          const value = raw ? JSON.parse(raw) : [];
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      })();

      const oldRecent = (() => {
        try {
          const raw = localStorage.getItem("studyLabRecent");
          const value = raw ? JSON.parse(raw) : [];
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      })();

      const favoriteRows = oldFavorites
        .map(item => typeof item === "string" ? item : item?.url)
        .filter(Boolean)
        .map(url => {
          const meta = oldMeta[url] || {};
          return {
            user_id: userId,
            tool_url: url,
            title: meta.title || "",
            description: meta.description || "",
            subject: meta.subject || "study-lab"
          };
        });

      const progressMap = new Map();

      oldExplored.forEach(item => {
        if (!item?.url) return;
        const existing = progressMap.get(item.url);
        const stamp = item.savedAt || Date.now();

        if (!existing || stamp > existing.last_opened_at) {
          progressMap.set(item.url, {
            user_id: userId,
            tool_url: item.url,
            title: item.title || "Untitled tool",
            subject: item.subject || "study-lab",
            first_opened_at: new Date(existing?.first_opened_at || stamp).toISOString(),
            last_opened_at: new Date(stamp).toISOString()
          });
        }
      });

      oldRecent.forEach(item => {
        if (!item?.url) return;
        const stamp = item.savedAt || Date.now();
        const existing = progressMap.get(item.url);

        if (!existing) {
          progressMap.set(item.url, {
            user_id: userId,
            tool_url: item.url,
            title: item.title || "Untitled tool",
            subject: item.subject || "study-lab",
            first_opened_at: new Date(stamp).toISOString(),
            last_opened_at: new Date(stamp).toISOString()
          });
          return;
        }

        if (stamp > new Date(existing.last_opened_at).getTime()) {
          existing.last_opened_at = new Date(stamp).toISOString();
        }
      });

      if (favoriteRows.length) {
        const { error } = await client
          .from("studylab_favorites")
          .upsert(favoriteRows, { onConflict: "user_id,tool_url" });

        if (error) throw error;
      }

      const progressRows = [...progressMap.values()].map(row => ({
        ...row,
        open_count: 1
      }));

      if (progressRows.length) {
        const { error } = await client
          .from("studylab_progress")
          .upsert(progressRows, { onConflict: "user_id,tool_url" });

        if (error) throw error;
      }

      /*
       * Only remove the old browser app-data after cloud writes
       * have succeeded. Supabase Auth itself still uses browser
       * storage to keep the authentication session alive.
       */
      [
        "studyLabFavorites",
        "studyLabFavoriteMeta",
        "studyLabRecent",
        "studyLabExploredTools"
      ].forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn("StudyLab dashboard migration:", error);
    }
  }

  async function loadCloudDashboard() {
    const account = getCloudAccount();
    if (!account?.ready) {
      throw new Error("StudyLab cloud account unavailable.");
    }

    await account.ready;

    const client = account.client;
    const user = account.getUser?.();

    if (!client || !user?.id) {
      throw new Error("StudyLab student account is unavailable.");
    }

    cloud.client = client;
    cloud.userId = user.id;

    await migrateLocalDashboardData(client, user.id);

    const [favoritesResult, progressResult] = await Promise.all([
      client
        .from("studylab_favorites")
        .select("tool_url,title,description,subject,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

      client
        .from("studylab_progress")
        .select("tool_url,title,subject,first_opened_at,last_opened_at,open_count")
        .eq("user_id", user.id)
        .order("last_opened_at", { ascending: false })
    ]);

    if (favoritesResult.error) throw favoritesResult.error;
    if (progressResult.error) throw progressResult.error;

    cloud.favorites = new Map(
      (favoritesResult.data || []).map(row => [row.tool_url, row])
    );

    cloud.progress = new Map(
      (progressResult.data || []).map(row => [row.tool_url, row])
    );

    cloud.ready = true;
    cloud.error = null;
  }

  async function saveFavoriteCloud(card) {
    if (!cloud.ready || !cloud.client || !cloud.userId) return;

    const meta = buildMeta(
      card,
      card.dataset.studySubject || subject
    );

    const { error } = await cloud.client
      .from("studylab_favorites")
      .upsert({
        user_id: cloud.userId,
        tool_url: meta.url,
        title: meta.title,
        description: meta.description,
        subject: meta.subject
      }, { onConflict: "user_id,tool_url" });

    if (error) throw error;

    cloud.favorites.set(meta.url, {
      user_id: cloud.userId,
      tool_url: meta.url,
      title: meta.title,
      description: meta.description,
      subject: meta.subject
    });
  }

  async function deleteFavoriteCloud(url) {
    if (!cloud.ready || !cloud.client || !cloud.userId) return;

    const { error } = await cloud.client
      .from("studylab_favorites")
      .delete()
      .eq("user_id", cloud.userId)
      .eq("tool_url", url);

    if (error) throw error;

    cloud.favorites.delete(url);
  }

  async function saveProgressCloud(meta) {
    if (!cloud.ready || !cloud.client || !cloud.userId || !meta?.url) return;

    const now = new Date().toISOString();
    const existing = cloud.progress.get(meta.url);

    const payload = {
      user_id: cloud.userId,
      tool_url: meta.url,
      title: meta.title || "Untitled tool",
      subject: meta.subject || "study-lab",
      last_opened_at: now,
      open_count: (existing?.open_count || 0) + 1
    };

    if (!existing?.first_opened_at) {
      payload.first_opened_at = now;
    }

    const { data, error } = await cloud.client
      .from("studylab_progress")
      .upsert(payload, { onConflict: "user_id,tool_url" })
      .select("tool_url,title,subject,first_opened_at,last_opened_at,open_count")
      .single();

    if (error) throw error;

    cloud.progress.set(meta.url, {
      ...data,
      user_id: cloud.userId
    });
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
    if (document.getElementById("studyQuickAccess")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "study-quick-button";
    button.id = "studyQuickButton";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "studyQuickAccessPanel");
    button.innerHTML =
      '<span aria-hidden="true">⚡</span><span>Quick</span>';

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
