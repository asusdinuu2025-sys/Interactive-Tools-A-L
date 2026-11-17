/* Shared, text-only StudyLab pop-up rich text and readable hover timer.
   No HTML parsing: formatting tokens create DOM nodes, never executable markup. */
(function () {
  "use strict";
  if (window.StudyLabPopupFormat) return;
  const token = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([^*\n]+?)\*|_([^_\n]+?)_|\x60([^\x60\n]+?)\x60/g;
  function render(container, source) {
    container.replaceChildren();
    const input = String(source || "");
    function append(parent, segment, depth = 0) {
      if (depth > 3) {
        parent.append(document.createTextNode(segment));
        return;
      }
      const expression = new RegExp(token.source, "g");
      let end = 0, match;
      while ((match = expression.exec(segment))) {
        if (match.index > end)
          parent.append(document.createTextNode(segment.slice(end, match.index)));
        const index = match.slice(1).findIndex(value => value !== undefined);
        const tags = ["strong", "u", "s", "em", "em", "code"];
        const node = document.createElement(tags[index]);
        append(node, match[index + 1], depth + 1);
        parent.append(node);
        end = expression.lastIndex;
      }
      if (end < segment.length) parent.append(document.createTextNode(segment.slice(end)));
    }
    append(container, input);
    return container;
  }
  function armTimer(box, milliseconds, onElapsed) {
    const duration = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 8000;
    let remaining = duration, started = 0, handle = null, stopped = false;
    let hovering = false, focused = false;
    function pause() {
      if (stopped) return;
      if (handle !== null) {
        remaining = Math.max(0, remaining - (Date.now() - started));
        clearTimeout(handle);
        handle = null;
      }
      box.classList.add("slpopup-paused");
    }
    function resume() {
      if (stopped || hovering || focused || document.hidden) return;
      box.classList.remove("slpopup-paused");
      if (handle !== null) clearTimeout(handle);
      started = Date.now();
      handle = setTimeout(() => {
        handle = null;
        if (!stopped) onElapsed();
      }, remaining);
    }
    function enter() { hovering = true; pause(); }
    function leave() { hovering = false; resume(); }
    function focusIn() { focused = true; pause(); }
    function focusOut(event) {
      if (!event.relatedTarget || !box.contains(event.relatedTarget)) {
        focused = false;
        resume();
      }
    }
    function visibility() { if (document.hidden) pause(); else resume(); }
    box.addEventListener("pointerenter", enter);
    box.addEventListener("pointerleave", leave);
    box.addEventListener("mouseenter", enter);
    box.addEventListener("mouseleave", leave);
    box.addEventListener("focusin", focusIn);
    box.addEventListener("focusout", focusOut);
    document.addEventListener("visibilitychange", visibility);
    resume();
    return () => {
      stopped = true;
      if (handle !== null) clearTimeout(handle);
      for (const event of ["pointerenter", "mouseenter"])
        box.removeEventListener(event, enter);
      for (const event of ["pointerleave", "mouseleave"])
        box.removeEventListener(event, leave);
      box.removeEventListener("focusin", focusIn);
      box.removeEventListener("focusout", focusOut);
      document.removeEventListener("visibilitychange", visibility);
    };
  }
  window.StudyLabPopupFormat = Object.freeze({render, armTimer});
})();
