/* A cosmetic blue name mark for a fixed set of existing StudyLab accounts.
   No verification workflow, access role, profile field, or permissions.
   Only Supabase Auth user IDs appear here; private email addresses are never embedded. */
(function () {
  "use strict";
  if (window.StudyLabNameMark) return;

  const allowedIds = new Set([
    "b6c80613-8217-48ac-851b-a39a3d9bef2b",
    "7c97a8d7-f047-4c88-883d-4bed9b1a5f99",
    "1f01a0f7-2030-4e14-b561-1e17648d4b3f",
    "24e78cd0-4565-407a-96f7-9cfde083f6d2"
  ]);
  const NS = "http://www.w3.org/2000/svg";

  function isMarked(userId) {
    return typeof userId === "string" && allowedIds.has(userId.toLowerCase().trim());
  }

  function decorate(nameNode, userId) {
    if (!nameNode || typeof nameNode.querySelector !== "function") return;
    const existing = nameNode.querySelector(":scope > .sl-name-mark");
    if (!isMarked(userId)) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const mark = document.createElement("span");
    mark.className = "sl-name-mark";
    mark.setAttribute("role", "img");
    mark.setAttribute("aria-label", "StudyLab account badge");
    mark.title = "StudyLab account badge";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const outline = document.createElementNS(NS, "path");
    outline.setAttribute("d", "M12 2.3 14.5 4l3-.1 1.3 2.6 2.7 1.3-.1 3L23 13.3l-1.7 2.4.1 3-2.7 1.3-1.3 2.6-3-.1-2.4 1.7-2.4-1.7-3 .1-1.3-2.6-2.7-1.3.1-3L1 13.3l1.7-2.5-.1-3 2.7-1.3L6.6 3.9l3 .1z");
    outline.setAttribute("fill", "currentColor");
    outline.setAttribute("transform", "translate(0 -1) scale(.96)");
    const check = document.createElementNS(NS, "path");
    check.setAttribute("d", "m7.5 12.3 3.1 3.1 6-6.5");
    check.setAttribute("fill", "none");
    check.setAttribute("stroke", "#ffffff");
    check.setAttribute("stroke-width", "2.1");
    check.setAttribute("stroke-linecap", "round");
    check.setAttribute("stroke-linejoin", "round");
    svg.append(outline, check);
    mark.append(svg);
    nameNode.append(mark);
  }

  Object.defineProperty(window, "StudyLabNameMark", {
    value: Object.freeze({ isMarked, decorate }),
    writable: false, configurable: false
  });
})();
