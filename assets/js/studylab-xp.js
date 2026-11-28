/* StudyLab XP. The UI reads exact award totals from Supabase. */
(function (root) {
  "use strict";

  const thresholds = Object.freeze([
    100, 200, 350, 550, 800, 1100, 1450, 1850, 2300, 2800,
    3300, 3800, 4300, 4800, 5300, 5800, 6300, 6800, 7300, 7800
  ]);
  const units = ["", "k", "m", "b", "t", "q", "qi"];
  const numberFormat = new Intl.NumberFormat("en-US");
  const account = () => root.StudyLabAccount;
  const xpValue = value => {
    if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
    return /^\d{1,19}$/.test(String(value ?? "")) ? BigInt(value) : null;
  };

  function compact(value) {
    const points = xpValue(value);
    if (points === null) return "—";
    let unit = 0;
    let divisor = 1n;
    while (unit < units.length - 1 && points >= divisor * 1000n) {
      divisor *= 1000n;
      unit++;
    }
    const whole = points / divisor;
    const decimal = points % divisor * 10n / divisor;
    return String(whole) + (decimal ? "." + decimal : "") + units[unit];
  }

  function progression(value) {
    const points = xpValue(value);
    if (points === null || points < 100n) return null;
    const next = thresholds.findIndex(boundary => BigInt(boundary) > points);
    const level = next < 0 ? thresholds.length : next;
    const from = thresholds[level - 1];
    const target = thresholds[level] ?? null;
    return {
      level, tier: Math.floor(level / 5), target,
      remaining: target === null ? 0 : target - Number(points),
      progress: target === null ? 100 : (Number(points) - from) * 100 / (target - from)
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { thresholds, compact, progression };
    return;
  }

  const d = root.document;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const el = (tag, className, text) => {
    const node = d.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function button(className, label) {
    const node = el("button", className, label);
    node.type = "button";
    return node;
  }

  function amount(node, value) {
    const string = numberFormat.format(xpValue(value) ?? 0n);
    const groups = string.split(",");
    const fragment = d.createDocumentFragment();
    groups.forEach((part, index) => {
      const last = index === groups.length - 1;
      fragment.append(el("span", "sl-xp-digits", last ? part + "\u00a0XP" : part + ","));
      if (!last) fragment.append(el("wbr"));
    });
    node.replaceChildren(fragment);
  }

  function levelBadge(state) {
    const badge = el("span", "sl-xp-level", "Level " + state.level);
    badge.dataset.tier = String(state.tier);
    return badge;
  }

  async function rpc(name, parameters) {
    const a = account();
    if (!a?.client) throw new Error("StudyLab is offline.");
    await a.ready;
    if (!a.getUser?.()) throw new Error("Sign in to use StudyLab XP.");
    const {data, error} = await a.client.rpc(name, parameters);
    if (error) throw error;
    return data;
  }

  async function totals(ids) {
    const unique = [...new Set(ids.filter(id => uuid.test(id)))];
    const chunks = [];
    for (let index = 0; index < unique.length; index += 100) {
      chunks.push(rpc("studylab_xp_totals", {p_users: unique.slice(index, index + 100)}));
    }
    return Object.assign(Object.create(null), ...await Promise.all(chunks));
  }

  async function showProfile(node, id, isCurrent) {
    try {
      const value = (await totals([id]))[id];
      const state = progression(value);
      if (!state || !isCurrent()) return;
      const points = el("strong", "sl-xp-full sl-xp-pill");
      amount(points, value);
      node.replaceChildren(levelBadge(state), points);
      node.hidden = false;
    } catch (_) {
      // A profile stays usable while the XP service is unavailable.
    }
  }

  // Keep the exact amount outside the card grid so it cannot be clipped by
  // the card's glass or expand neighbouring cards.
  let popup, anchor, frame = 0;
  function closePopup() {
    if (!anchor) return;
    anchor.setAttribute("aria-expanded", "false");
    anchor = null;
    if (typeof popup.hidePopover === "function") popup.hidePopover();
    popup.hidden = true;
  }

  function layoutPopup() {
    frame = 0;
    if (!anchor?.isConnected) { closePopup(); return; }
    const rect = anchor.getBoundingClientRect();
    const viewport = root.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || d.documentElement.clientWidth);
    const bottom = top + (viewport?.height || d.documentElement.clientHeight);
    if (rect.bottom < top || rect.top > bottom || rect.right < left || rect.left > right) {
      closePopup();
      return;
    }
    popup.style.maxWidth = Math.max(1, Math.min(368, right - left - 16)) + "px";
    const width = popup.offsetWidth, height = popup.offsetHeight;
    const x = Math.max(left + 8, Math.min(right - width - 8, rect.right - width));
    const y = rect.bottom + height + 8 <= bottom
      ? rect.bottom + 6 : Math.max(top + 8, rect.top - height - 6);
    popup.style.left = x + "px";
    popup.style.top = y + "px";
  }

  function reposition() {
    if (anchor && !frame) frame = root.requestAnimationFrame(layoutPopup);
  }

  function showPopup(trigger) {
    if (anchor === trigger) { closePopup(); return; }
    const state = progression(trigger.dataset.xp);
    if (!state) return;
    closePopup();
    if (!popup) {
      popup = el("div", "sl-xp-popup");
      popup.id = "slXpExact";
      popup.setAttribute("role", "region");
      popup.setAttribute("aria-label", "Exact XP and level");
      if (typeof popup.showPopover === "function") popup.setAttribute("popover", "manual");
      popup.hidden = true;
      d.body.append(popup);
    }
    anchor = trigger;
    const points = el("strong", "sl-xp-full");
    amount(points, trigger.dataset.xp);
    popup.replaceChildren(levelBadge(state), points);
    popup.hidden = false;
    if (typeof popup.showPopover === "function") popup.showPopover();
    anchor.setAttribute("aria-expanded", "true");
    layoutPopup();
  }

  function mountLiveGrid(grid) {
    const cache = new Map();
    let pending = false, refreshAfter = false, retryAfter = 0;
    function ensureChips() {
      if (anchor && !anchor.isConnected) closePopup();
      for (const card of grid.querySelectorAll(".room-person-card[data-user-id]")) {
        const id = card.dataset.userId;
        let chip = card.querySelector(".sl-xp-live-chip");
        if (!chip) {
          chip = button("sl-xp-live-chip sl-xp-pill", "");
          chip.hidden = true;
          chip.setAttribute("aria-expanded", "false");
          chip.setAttribute("aria-controls", "slXpExact");
          chip.addEventListener("click", event => {
            event.stopPropagation();
            showPopup(chip);
          });
          const row = el("div", "sl-xp-live-row");
          row.hidden = true;
          row.append(chip);
          const subject = card.querySelector(".room-person-card-subject");
          if (!subject) continue;
          const meta = el("div", "sl-xp-card-meta");
          subject.before(meta);
          meta.append(subject, row);
        }
        const value = cache.get(id)?.value;
        const available = progression(value) !== null;
        chip.hidden = !available;
        chip.parentElement.hidden = !available;
        if (!available && anchor === chip) closePopup();
        if (available) {
          const changed = chip.dataset.xp !== String(value);
          chip.dataset.xp = String(value);
          const label = compact(value) + " XP";
          if (chip.textContent !== label) chip.textContent = label;
          const description = label + ". Show exact XP and level";
        if (chip.getAttribute("aria-label") !== description) chip.setAttribute("aria-label", description);
          if (changed && anchor === chip) {
            const text = popup.querySelector(".sl-xp-full");
            amount(text, value);
            popup.firstElementChild.replaceWith(levelBadge(progression(value)));
            reposition();
          }
        }
      }
    }
    async function refresh(force = false) {
      ensureChips();
      if (d.hidden || (!force && Date.now() < retryAfter)) return;
      if (pending) { refreshAfter = true; return; }
      const ids = [...new Set([...grid.querySelectorAll(".room-person-card[data-user-id]")]
        .map(card => card.dataset.userId))];
      const current = new Set(ids);
      for (const id of cache.keys()) if (!current.has(id)) cache.delete(id);
      const requested = ids.filter(id => force || !cache.has(id) || Date.now() - cache.get(id).at > 55000);
      if (!requested.length) return;
      pending = true;
      try {
        const data = await totals(requested);
        for (const id of requested) cache.set(id, {value: data[id] ?? null, at: Date.now()});
        retryAfter = 0;
        ensureChips();
      } catch (_) {
        retryAfter = Date.now() + 15000;
      } finally {
        pending = false;
        if (refreshAfter) { refreshAfter = false; void refresh(); }
      }
    }
    new MutationObserver(() => void refresh()).observe(grid, {childList: true});
    root.setInterval(refresh, 60000);
    d.addEventListener("visibilitychange", () => { if (!d.hidden) void refresh(true); });
    root.addEventListener("online", () => void refresh(true));
    d.addEventListener("studylab:xp-changed", event => {
      const {id, xp} = event.detail;
      if (!cache.has(id)) return;
      cache.set(id, {value: xp, at: Date.now()});
      ensureChips();
    });
    d.addEventListener("pointerdown", event => {
      if (anchor && !anchor.contains(event.target) && !popup.contains(event.target)) closePopup();
    });
    d.addEventListener("keydown", event => {
      if (anchor && event.key === "Escape") {
        event.preventDefault();
        closePopup();
      }
    }, true);
    root.addEventListener("resize", reposition);
    root.addEventListener("scroll", reposition, true);
    root.visualViewport?.addEventListener("resize", reposition);
    root.visualViewport?.addEventListener("scroll", reposition);
    void refresh();
  }

  function mountRankings(section) {
    const timeBoard = section.querySelector("#leaderboardList");
    const timeTabs = section.querySelector(".room-tabs");
    if (!timeBoard || !timeTabs) return;
    const controls = el("div", "sl-xp-ranking-toggle");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Rank by");
    const modes = new Map([
      ["time", button("sl-xp-toggle", "Study Time")],
      ["total", button("sl-xp-toggle", "Total XP")],
      ["study", button("sl-xp-toggle", "Study XP")]
    ]);
    controls.append(...modes.values());
    const panel = el("div", "sl-xp-rankings");
    const sub = el("p", "sl-xp-caption");
    const studyTabs = el("div", "sl-xp-ranking-toggle");
    studyTabs.setAttribute("role", "group");
    studyTabs.setAttribute("aria-label", "Study XP period");
    const periods = new Map([
      ["today", button("sl-xp-toggle", "Today")],
      ["week", button("sl-xp-toggle", "This Week")]
    ]);
    studyTabs.append(...periods.values());
    const list = el("ol", "sl-xp-ranking-list");
    const status = el("p", "sl-xp-caption");
    status.setAttribute("role", "status");
    status.hidden = true;
    const own = el("p", "sl-xp-own-rank");
    own.hidden = true;
    panel.append(sub, studyTabs, status, list, own);
    timeBoard.before(controls);
    timeBoard.after(panel);
    let mode = "time", period = "today", serial = 0, signature = "", lastRequest = 0;

    function statusText(message) {
      status.hidden = !message;
      if (status.textContent !== message) status.textContent = message;
    }

    function visibleMode() {
      const studyTime = mode === "time";
      timeTabs.hidden = !studyTime;
      timeBoard.hidden = !studyTime;
      panel.hidden = studyTime;
      studyTabs.hidden = mode !== "study";
      for (const [value, control] of modes) control.setAttribute("aria-pressed", String(mode === value));
      for (const [value, control] of periods) control.setAttribute("aria-pressed", String(period === value));
      sub.textContent = mode === "total" ? "All time · Includes Plus bonuses" : "From study time, goals and tasks";
    }

    async function fetchBoard(clear = false) {
      if (mode === "time" || d.hidden) return;
      const request = ++serial;
      lastRequest = Date.now();
      if (clear) {
        signature = "";
        list.replaceChildren();
        own.hidden = true;
        statusText("Loading rankings…");
      }
      try {
        const board = await rpc("studylab_xp_leaderboard", {p_metric: mode, p_period: period, p_limit: 50});
        if (request !== serial || mode === "time") return;
        const entries = Array.isArray(board?.entries) ? board.entries : [];
        statusText(entries.length ? "" : "No XP recorded for this view yet.");
        const nextSignature = JSON.stringify(board);
        if (nextSignature === signature) return;
        signature = nextSignature;
        const rows = entries.map(entry => {
          const item = el("li", "sl-xp-rank");
          const position = el("span", "sl-xp-position", "#" + String(entry.rank));
          const name = button("sl-xp-rank-name", entry.name || "Student");
          name.addEventListener("click", () => root.StudyLabProfileView?.open({userId: entry.user_id}));
          root.StudyLabNameMark?.decorate(name, entry.user_id);
          root.StudyLabPlus?.decorateName?.(name, entry.user_id);
          const points = el("strong", "sl-xp-full");
          amount(points, entry.xp);
          item.append(position, name, points);
          return item;
        });
        list.replaceChildren(...rows);
        own.hidden = !board?.own;
        if (board?.own) {
          const full = el("strong", "sl-xp-full");
          amount(full, board.own.xp);
          own.replaceChildren("Your rank #" + board.own.rank + " · ", full);
        }
      } catch (_) {
        if (request !== serial || mode === "time") return;
        statusText(list.childElementCount ? "Couldn’t refresh XP rankings." : "XP rankings are temporarily unavailable.");
      }
    }

    for (const [value, control] of modes) control.addEventListener("click", () => {
      if (mode === value) return;
      serial++;
      mode = value;
      visibleMode();
      void fetchBoard(true);
    });
    for (const [value, control] of periods) control.addEventListener("click", () => {
      if (period === value) return;
      period = value;
      visibleMode();
      void fetchBoard(true);
    });
    visibleMode();
    root.setInterval(fetchBoard, 60000);
    d.addEventListener("visibilitychange", () => { if (!d.hidden) void fetchBoard(); });
    root.addEventListener("online", () => void fetchBoard());
    d.addEventListener("studylab:xp-changed", () => {
      if (Date.now() - lastRequest > 15000) void fetchBoard();
    });
  }

  let ownRefresh;
  function mountProgress(panel) {
    const slot = el("section", "sl-xp-progress");
    const header = el("div", "sl-xp-progress-header");
    const points = el("strong", "sl-xp-full");
    const label = el("p", "sl-xp-caption", "Loading XP…");
    const bar = el("progress", "sl-xp-progress-bar");
    bar.setAttribute("aria-label", "Progress to the next level");
    bar.max = 100;
    bar.hidden = true;
    const celebration = el("p", "sl-xp-celebration");
    celebration.setAttribute("role", "status");
    celebration.hidden = true;
    slot.append(header, label, bar, celebration);
    panel.querySelector(".sl-head")?.after(slot);
    let savedAt = "", viewerId, lastValue, lastLevel, pending = false, queued = false, requestedAt = 0;

    async function refresh(force = false) {
      if (d.hidden || (!force && Date.now() - requestedAt < 15000)) return;
      if (pending) { if (force) queued = true; return; }
      const user = account()?.getUser?.();
      if (!user || user.is_anonymous) {
        if (viewerId || !d.hidden) label.textContent = "Sign in to earn XP.";
        header.replaceChildren();
        bar.hidden = true;
        celebration.hidden = true;
        viewerId = lastValue = lastLevel = undefined;
        return;
      }
      if (viewerId !== user.id) {
        viewerId = user.id;
        lastValue = lastLevel = undefined;
        header.replaceChildren();
        bar.hidden = true;
        celebration.hidden = true;
      }
      pending = true;
      requestedAt = Date.now();
      try {
        const value = (await totals([user.id]))[user.id];
        if (account()?.getUser?.()?.id !== user.id) return;
        const state = progression(value);
        if (!state) {
          header.replaceChildren();
          label.textContent = "Complete your StudyLab profile to see XP.";
          bar.hidden = true;
          return;
        }
        if (value === lastValue && !bar.hidden) {
          label.textContent = state.target === null ? "Max level reached"
            : numberFormat.format(state.remaining) + " XP to Level " + (state.level + 1);
          return;
        }
        amount(points, value);
        header.replaceChildren(levelBadge(state), points);
        bar.hidden = false;
        bar.value = state.progress;
        bar.setAttribute("aria-valuetext", Math.floor(state.progress) + "%");
        label.textContent = state.target === null ? "Max level reached"
          : numberFormat.format(state.remaining) + " XP to Level " + (state.level + 1);
        if (lastLevel && state.level > lastLevel) {
          celebration.hidden = false;
          celebration.textContent = "You reached Level " + state.level + "!";
          celebration.classList.remove("is-celebrating");
          root.requestAnimationFrame(() => celebration.classList.add("is-celebrating"));
        } else if (lastLevel && state.level < lastLevel) {
          celebration.hidden = true;
        }
        lastLevel = state.level;
        lastValue = value;
        d.dispatchEvent(new CustomEvent("studylab:xp-changed", {detail: {id: user.id, xp: value}}));
      } catch (_) {
        label.textContent = header.childElementCount
          ? "Couldn’t refresh your XP." : "XP is temporarily unavailable.";
      } finally {
        pending = false;
        if (queued) { queued = false; void refresh(true); }
      }
    }

    ownRefresh = () => void refresh(true);
    root.addEventListener("studylab:study-room-timer", event => {
      const nextSavedAt = event.detail?.updatedAt;
      if (nextSavedAt && nextSavedAt !== savedAt) {
        savedAt = nextSavedAt;
        void refresh();
      }
    });
    root.setInterval(refresh, 60000);
    root.addEventListener("online", ownRefresh);
    root.addEventListener("studylab-profile-updated", ownRefresh);
    d.addEventListener("visibilitychange", () => { if (!d.hidden) ownRefresh(); });
    void refresh(true);
  }

  root.StudyLabXP = Object.freeze({
    showProfile, mountProgress, rpc, refreshOwn: () => ownRefresh?.()
  });

  function init() {
    const grid = d.getElementById("peopleGrid");
    const rankings = d.getElementById("leaderboardSection");
    if (grid) mountLiveGrid(grid);
    if (rankings) mountRankings(rankings);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init, {once: true});
  else init();
})(typeof window === "undefined" ? globalThis : window);
