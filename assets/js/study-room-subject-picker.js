/* StudyLab Study Room: single searchable subject dropdown.
   Keeps the existing #studySubject select as the sole value used by the RPCs. */
(() => {
  "use strict";
  const select = document.getElementById("studySubject");
  const root = document.getElementById("roomSubjectCombobox");
  const input = document.getElementById("studySubjectCombo");
  const list = document.getElementById("studySubjectOptions");
  if (!select || !root || !input || !list) return;

  const subjects = Array.from(select.options)
    .filter(option => option.value)
    .map(option => ({value: option.value, label: option.textContent.trim()}));
  const selectedLabel = value => subjects.find(item => item.value === value)?.label || "";
  let visible = [];
  let active = -1;
  let expanded = false;

  function sync() {
    if (expanded && document.activeElement === input) return;
    input.value = selectedLabel(select.value);
    input.setAttribute("aria-invalid", select.getAttribute("aria-invalid") || "false");
    input.removeAttribute("aria-activedescendant");
  }
  function close(restore = true) {
    expanded = false;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    active = -1;
    if (restore) sync();
  }
  function highlight(index) {
    if (!visible.length) return;
    active = (index + visible.length) % visible.length;
    list.querySelectorAll('[role="option"]').forEach((node, i) => {
      node.classList.toggle("is-active", i === active);
      node.setAttribute("aria-selected", String(i === active));
    });
    const current = list.querySelectorAll('[role="option"]')[active];
    if (!current) return;
    input.setAttribute("aria-activedescendant", current.id);
    current.scrollIntoView({block:"nearest"});
  }
  function choose(value) {
    if (!subjects.some(item => item.value === value)) return;
    select.value = value;
    close(false);
    sync();
    input.focus();
    select.dispatchEvent(new Event("change", {bubbles:true}));
  }
  function draw(filter = "") {
    const query = filter.trim().toLocaleLowerCase();
    visible = subjects.filter(item => item.label.toLocaleLowerCase().includes(query));
    active = -1;
    list.replaceChildren();
    input.removeAttribute("aria-activedescendant");
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "room-subject-empty";
      empty.textContent = "No matching subjects";
      list.append(empty);
      return;
    }
    visible.forEach((item, i) => {
      const option = document.createElement("button");
      option.type = "button";
      option.id = "room-subject-option-" + i;
      option.className = "room-subject-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(item.value === select.value));
      option.textContent = item.label;
      option.addEventListener("pointerdown", event => event.preventDefault());
      option.addEventListener("click", () => choose(item.value));
      list.append(option);
    });
  }
  function open(query = "") {
    draw(query);
    list.hidden = false;
    expanded = true;
    input.setAttribute("aria-expanded", "true");
  }

  root.hidden = false;
  document.body.classList.add("room-subject-picker-ready");
  const label = document.querySelector('label[for="studySubject"]');
  label?.setAttribute("for", "studySubjectCombo");
  input.addEventListener("focus", () => open(""));
  input.addEventListener("click", () => {if (!expanded) open("");});
  input.addEventListener("input", () => {
    // Typing a search is not choosing a subject. A new session still requires
    // an explicit click or Enter, and existing server sessions are unchanged.
    if (!window.StudyRoomTimer?.getState?.()?.sessionActive) select.value = "";
    open(input.value);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!expanded) open(input.value);
      highlight(active + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      if (!expanded) return;
      event.preventDefault();
      if (active >= 0) choose(visible[active].value);
      else if (visible.length === 1) choose(visible[0].value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  });
  document.addEventListener("pointerdown", event => {
    if (!root.contains(event.target)) close();
  });
  select.addEventListener("change", sync);
  window.StudyRoomSubjectPicker = {
    focus() { input.focus(); open(""); },
    sync() {if (!expanded) sync();},
    getSelected() {return select.value;}
  };
  sync();
})();
