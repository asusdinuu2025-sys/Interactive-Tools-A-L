/* =========================================================
   STUDY LAB — TOOL REACTIONS
   Uses one summary request per page; no realtime connection.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    table: "studylab_reactions",
    rpc: "get_studylab_reaction_summary"
  };

  let client = null;
  let userId = null;

  function cardUrl(card) {
    return card.getAttribute("href") || card.href || "";
  }

  function cardTitle(card) {
    return card.querySelector("h2,h3")?.textContent.replace(/\s+/g, " ").trim() || "Tool";
  }

  function buildReactionRow(card) {
    if (card.querySelector(".study-reactions")) return card.querySelector(".study-reactions");

    const row = document.createElement("div");
    row.className = "study-reactions";
    row.dataset.reactionUrl = cardUrl(card);

    const defs = [
      ["useful", "👍", "Useful"],
      ["helpful", "❤️", "Helpful"],
      ["popular", "🔥", "Popular"]
    ];

    defs.forEach(([reaction, icon, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "study-reaction";
      button.dataset.reaction = reaction;
      button.setAttribute("aria-label", label + " for " + cardTitle(card));
      button.innerHTML = '<span aria-hidden="true">' + icon + '</span><span class="study-reaction-count">0</span>';
      row.appendChild(button);
    });

    card.appendChild(row);
    card.classList.add("study-has-reactions");

    return row;
  }

  function updateRow(row, summary) {
    if (!row || !summary) return;

    ["useful", "helpful", "popular"].forEach(reaction => {
      const button = row.querySelector('[data-reaction="' + reaction + '"]');
      const count = row.querySelector('[data-reaction="' + reaction + '"] .study-reaction-count');
      if (count) count.textContent = String(Number(summary[reaction]) || 0);
      button?.classList.toggle(
        "active",
        Array.isArray(summary.mine) && summary.mine.includes(reaction)
      );
    });
  }

  async function toggleReaction(card, reaction) {
    if (!client || !userId) return;

    const wasActive = card.querySelector(
      '[data-reaction="' + reaction + '"]'
    )?.classList.contains("active");

    try {
      if (wasActive) {
        const { error } = await client
          .from(CONFIG.table)
          .delete()
          .eq("user_id", userId)
          .eq("tool_url", cardUrl(card))
          .eq("reaction", reaction);

        if (error) throw error;
      } else {
        const { error } = await client
          .from(CONFIG.table)
          .insert({
            user_id: userId,
            tool_url: cardUrl(card),
            reaction
          });

        if (error) throw error;
      }

      await refreshSummary();
    } catch (error) {
      console.warn("StudyLab reaction:", error);
    }
  }

  async function refreshSummary() {
    const cards = [...document.querySelectorAll(".tool-card")].filter(card => cardUrl(card));
    if (!cards.length || !client || !userId) return;

    const urls = [...new Set(cards.map(card => cardUrl(card)))];

    const { data, error } = await client.rpc(CONFIG.rpc, {
      p_tool_urls: urls
    });

    if (error) {
      console.warn("StudyLab reaction summary:", error);
      return;
    }

    const summaries = new Map(
      (data || []).map(row => [row.tool_url, row])
    );

    cards.forEach(card => {
      const row = buildReactionRow(card);
      updateRow(row, summaries.get(cardUrl(card)) || {
        useful: 0,
        helpful: 0,
        popular: 0,
        mine: []
      });
    });
  }

  function attachObservers() {
    const observer = new MutationObserver(() => {
      refreshSummary();
    });

    const grids = [...document.querySelectorAll(".tool-grid, .card-grid")];
    grids.forEach(grid => {
      observer.observe(grid, { childList: true, subtree: true });
    });
  }

  async function boot() {
    const account = window.StudyLabAccount;
    if (!account?.ready) return;

    try {
      await account.ready;
      client = account.client;
      userId = account.getUser?.()?.id || null;
      if (!client || !userId) return;

      await refreshSummary();
      attachObservers();
    } catch (error) {
      console.warn("StudyLab reactions:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
