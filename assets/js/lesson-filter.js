/*
 * Study-Lab automatic subject filter
 * Automatically classifies cards by visible text:
 *   All → Lesson 01... → Resources → Past Papers
 * No data-category/data-lesson attribute is required.
 */
(function () {
  "use strict";

  const root = document.getElementById("lessonFilter");
  const grid = document.querySelector(".tool-grid");
  const subject = document.body.dataset.filterSubject;

  // Maths intentionally has no filter.
  if (!root || !grid || !subject || subject === "maths") return;

  const maxLessons = {
    chemistry: 14,
    biology: 10,
    physics: 11
  }[subject];

  if (!maxLessons) return;

  const cardText = card => card.textContent.replace(/\s+/g, " ").trim();

  function unique(values) {
    return [...new Set(values)];
  }

  function getLessonNumbers(text) {
    const found = [];
    let match;

    // Examples: "Lesson 04", "lesson 4"
    const lessonPattern = /\\blesson\\s*(0?[1-9]|1[0-9])\\b/gi;

    while ((match = lessonPattern.exec(text)) !== null) {
      found.push(Number(match[1]));
    }

    // Examples: "04. තාපය", "08/ ධාරා විද්‍යුතය", "03: දෝලන"
    const numberedPattern = /(?:^|\\s)(0?[1-9]|1[0-9])\\s*[.\\/:\\-]\\s*/g;

    while ((match = numberedPattern.exec(text)) !== null) {
      found.push(Number(match[1]));
    }

    /*
     * Backward compatibility for older Chemistry cards that were created
     * before lesson numbers were placed in their titles.
     */
    if (subject === "chemistry") {
      const rules = [
        { lesson: 5, pattern: /energetics|ශක්ති\s*විද්‍යාව|enthalpy|thermochem/i },
        { lesson: 6, pattern: /nh3|nh₃|cation|කැටායන|fe²|fe³|h2so4|h₂so₄|anion|ඇනායන|flame|පහන්\s*සිළු|inorganic|අකාබනික|කාණ්ඩ\s*විශ්ලේෂණ/i },
        { lesson: 7, pattern: /organic|කාබනික/i },
        { lesson: 11, pattern: /kinetic|kinetics|චාලක\s*රසායනය/i },
        { lesson: 12, pattern: /equilibrium|සමතුලිතතාවය|සමතුලිත/i }
      ];

      rules.forEach(rule => {
        if (rule.pattern.test(text)) found.push(rule.lesson);
      });
    }

    return unique(found.filter(n => n >= 1 && n <= maxLessons));
  }

  function getCards() {
    return [...grid.querySelectorAll(":scope > .tool-card")].map(element => {
      const text = cardText(element);
      const lessons = getLessonNumbers(text);
      const isPastPaper = /past\s*papers?|past\s*paper|pastpaper/i.test(text);

      return {
        element,
        text,
        lessons,
        isPastPaper,
        type: isPastPaper ? "pastpaper" : lessons.length ? "lesson" : "resource"
      };
    });
  }

  let cards = getCards();
  let activeFilter = "all";
  let lastSignature = "";

  function cardSignature() {
    return [...grid.querySelectorAll(":scope > .tool-card")]
      .map(card => cardText(card))
      .join("\u0001");
  }

  function countFor(filterId) {
    if (filterId === "all") return cards.length;
    if (filterId === "resources") {
      return cards.filter(card => card.type === "resource").length;
    }
    if (filterId === "pastpapers") {
      return cards.filter(card => card.type === "pastpaper").length;
    }

    const lesson = Number(filterId.replace("lesson-", ""));
    return cards.filter(card => card.lessons.includes(lesson)).length;
  }

  function labelFor(filterId) {
    if (filterId === "all") return "All";
    if (filterId === "resources") return "Resources";
    if (filterId === "pastpapers") return "Past Papers";

    const lesson = Number(filterId.replace("lesson-", ""));
    return String(lesson).padStart(2, "0") + ".";
  }

  function menuOptions() {
    return [
      { id: "all", label: "All" },
      ...Array.from({ length: maxLessons }, (_, index) => {
        const lesson = index + 1;
        return {
          id: "lesson-" + lesson,
          label: String(lesson).padStart(2, "0") + "."
        };
      }),
      { id: "resources", label: "Resources" },
      { id: "pastpapers", label: "Past Papers" }
    ];
  }

  function render() {
    root.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "lesson-filter-buttons";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "lesson-filter-button";
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML =
      '<span class="lesson-filter-current">Filter</span>' +
      '<span class="lesson-filter-arrow" aria-hidden="true">⌄</span>';

    const menu = document.createElement("div");
    menu.className = "lesson-filter-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");

    menuOptions().forEach(option => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lesson-filter-option";
      item.dataset.filter = option.id;
      item.setAttribute("role", "menuitem");
      item.innerHTML =
        '<span class="lesson-filter-option-label">' + option.label + "</span>";

      item.addEventListener("click", () => {
        activeFilter = option.id;
        applyFilter(activeFilter);
        menu.hidden = true;
        root.classList.remove("open");
        button.setAttribute("aria-expanded", "false");
      });

      menu.appendChild(item);
    });

    button.addEventListener("click", event => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      root.classList.toggle("open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
    });

    wrapper.appendChild(button);
    wrapper.appendChild(menu);
    root.appendChild(wrapper);

    updateButtonLabel();
    updateActiveOption();
  }

  function updateButtonLabel() {
    const current = root.querySelector(".lesson-filter-current");
    if (!current) return;

    current.textContent =
      activeFilter === "all"
        ? "Filter"
        : labelFor(activeFilter);
  }

  function updateActiveOption() {
    root.querySelectorAll(".lesson-filter-option").forEach(option => {
      const active = option.dataset.filter === activeFilter;
      option.classList.toggle("active", active);
      option.setAttribute("aria-selected", String(active));
    });
  }

  function applyFilter(filterId) {
    cards.forEach(card => {
      let visible;

      if (filterId === "all") {
        visible = true;
      } else if (filterId === "resources") {
        visible = card.type === "resource";
      } else if (filterId === "pastpapers") {
        visible = card.type === "pastpaper";
      } else {
        const lesson = Number(filterId.replace("lesson-", ""));
        visible = card.lessons.includes(lesson);
      }

      card.element.hidden = !visible;
    });

    activeFilter = filterId;
    updateButtonLabel();
    updateActiveOption();
  }

  document.addEventListener("click", event => {
    if (!root.contains(event.target)) {
      const menu = root.querySelector(".lesson-filter-menu");
      if (menu && !menu.hidden) {
        menu.hidden = true;
        root.classList.remove("open");
        root.querySelector(".lesson-filter-button")
          ?.setAttribute("aria-expanded", "false");
      }
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      const menu = root.querySelector(".lesson-filter-menu");
      if (menu && !menu.hidden) {
        menu.hidden = true;
        root.classList.remove("open");
        root.querySelector(".lesson-filter-button")
          ?.setAttribute("aria-expanded", "false");
      }
    }
  });

  function refreshIfCardsChanged() {
    const latestSignature = cardSignature();

    if (latestSignature !== lastSignature) {
      lastSignature = latestSignature;
      cards = getCards();
      render();
      applyFilter(activeFilter);
    }
  }

  lastSignature = cardSignature();
  render();
  applyFilter("all");

  // Future cards are automatically reclassified from their visible title/text.
  const observer = new MutationObserver(refreshIfCardsChanged);
  observer.observe(grid, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
