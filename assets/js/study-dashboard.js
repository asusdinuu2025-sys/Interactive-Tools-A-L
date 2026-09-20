/*
 * Study-Lab personal study dashboard
 *
 * Local-device only:
 * - Quick Find search
 * - Favorites
 * - Recently opened
 * - Unique tools explored progress
 * - Floating Quick Access panel
 *
 * No account, server, cookie, or external service is required.
 */
(function () {
  "use strict";

  const STORAGE = {
    favorites: "studyLabFavorites",
    recent: "studyLabRecent",
    explored: "studyLabExploredTools"
  };

  const MAX_RECENT = 8;
  const subject = (document.body.dataset.filterSubject || "").trim().toLowerCase();

  const SELECTORS = {
    toolGrid: ".tool-grid",
    subjectGrid: ".card-grid"
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the UI usable if storage is unavailable/full.
    }
  }

  function getFavorites() {
    const value = readJSON(STORAGE.favorites, []);
    return Array.isArray(value) ? value : [];
  }

  function saveFavorites(value) {
    writeJSON(STORAGE.favorites, [...new Set(value)]);
  }

  function getRecent() {
    const value = readJSON(STORAGE.recent, []);
    return Array.isArray(value) ? value : [];
  }

  function saveRecent(value) {
    writeJSON(STORAGE.recent, value.slice(0, MAX_RECENT));
  }

  function getExplored() {
    const value = readJSON(STORAGE.explored, []);
    return Array.isArray(value) ? value : [];
  }

  function saveExplored(value) {
    writeJSON(STORAGE.explored, value);
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
    button.textContent = active ? "★" : "☆";
  }

  function toggleFavorite(card) {
    const favorites = favoriteSet();
    if (favorites.has(card.href)) {
      favorites.delete(card.href);
    } else {
      favorites.add(card.href);
    }

    saveFavorites([...favorites]);

    const button = card.querySelector(".study-favorite-toggle");
    if (button) updateFavoriteButton(card, button);

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
    let explored = getExplored().filter(item => item?.url !== meta.url);
    explored.push(meta);
    saveExplored(explored);

    let recent = getRecent().filter(item => item?.url !== meta.url);
    recent.unshift(meta);
    saveRecent(recent);

    refreshQuickPanel();
    refreshProgress();
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
          <small>Saved only on this device</small>
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
        .map(url => recent.find(item => item?.url === url) || {
          url,
          title: "Saved tool",
          subject: subject || "study-lab"
        })
        .slice(0, 8);

      if (!favoriteEntries.length) {
        favoriteList.innerHTML = '<div class="study-quick-empty">No favorites yet.</div>';
      } else {
        favoriteEntries.forEach(item => favoriteList.appendChild(makeQuickItem(item, "favorite")));
      }
    }

    if (recentList) {
      recentList.innerHTML = "";

      if (!recent.length) {
        recentList.innerHTML = '<div class="study-quick-empty">No tools opened yet.</div>';
      } else {
        recent.slice(0, MAX_RECENT).forEach(item => recentList.appendChild(makeQuickItem(item, "recent")));
      }
    }

    const progressValue = panel.querySelector("#studyQuickProgressValue");
    const progressBar = panel.querySelector("#studyQuickProgressBar");
    const explored = getExplored();
    const currentTotal = document.querySelector(SELECTORS.toolGrid)?.querySelectorAll(":scope > .tool-card").length || 0;
    const currentExplored = subject
      ? new Set(explored.filter(item => item.subject === subject).map(item => item.url)).size
      : explored.length;

    if (progressValue) {
      progressValue.textContent = subject
        ? currentExplored + " / " + currentTotal + " explored"
        : explored.length + " tools explored";
    }

    if (progressBar) {
      const percent = subject && currentTotal
        ? Math.round(Math.min(currentExplored, currentTotal) / currentTotal * 100)
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

  function boot() {
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
