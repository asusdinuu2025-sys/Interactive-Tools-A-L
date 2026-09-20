/*
 * Study-Lab automatic subject filter
 * Reads the lesson number directly from each card's visible text.
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

  const cardText = card => card.textContent.replace(/s+/g, " ").trim();

  function unique(values) {
    return [...new Set(values)];
  }

  function getLessonNumbers(text) {
    const found = [];
    let match;

    // Examples: "Lesson 04", "lesson 4"
    const lessonPattern = /\blesson\s*(0?[1-9]|1[0-4])\b/gi;
    while ((match = lessonPattern.exec(text)) !== null) {
      found.push(Number(match[1]));
    }

    // Examples: "04. තාපය", "08/ ධාරා විද්‍යුතය", "03: දෝලන"
    const numberedPattern = /(?:^|\s)(0?[1-9]|1[0-4])\s*[.\/:\-]\s*/g;
    while ((match = numberedPattern.exec(text)) !== null) {
      found.push(Number(match[1]));
    }

    /*
     * Backward compatibility for older cards that were created before
     * lesson numbers were placed in their titles.
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
    return [...grid.querySelectorAll(":scope > .tool-card")].map(element => ({
      element,
      lessons: getLessonNumbers(cardText(element)),
      isPastPaper: /past\s*papers?|past\s*paper|pastpaper/i.test(cardText(element))
    }));
  }

  let cards = getCards();
  let activeFilter = "all";

  function countFor(filterId) {
    if (filterId === "all") return cards.length;

    const lesson = Number(filterId.replace("lesson-", ""));
    return cards.filter(card => card.lessons.includes(lesson)).length;
  }

  function labelFor(filterId) {
    if (filterId === "all") return "All";
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
      })
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
        '<span class="lesson-filter-option-label">' + option.label + "</span>" +
        '<span class="lesson-filter-option-count">[' + countFor(option.id) + ' cards]</span>';

      item.addEventListener("click", () => {
        activeFilter = option.id;
        applyFilter(activeFilter);
        menu.hidden = true;
        wrapper.parentElement.parentElement.classList.remove("open");
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
  }

  function updateButtonLabel() {
    const current = root.querySelector(".lesson-filter-current");
    if (!current) return;

    current.textContent =
      activeFilter === "all"
        ? "Filter"
        : labelFor(activeFilter) + " [" + countFor(activeFilter) + " cards]";
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
      let visible = filterId === "all";

      if (filterId !== "all") {
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
        const button = root.querySelector(".lesson-filter-button");
        button?.setAttribute("aria-expanded", "false");
      }
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      const menu = root.querySelector(".lesson-filter-menu");
      if (menu && !menu.hidden) {
        menu.hidden = true;
        root.classList.remove("open");
        root.querySelector(".lesson-filter-button")?.setAttribute("aria-expanded", "false");
      }
    }
  });

  function refreshIfCardsChanged() {
    const latestCount = grid.querySelectorAll(":scope > .tool-card").length;
    if (latestCount !== cards.length) {
      cards = getCards();
      render();
      applyFilter(activeFilter);
    }
  }

  render();
  applyFilter("all");

  // New cards added later are automatically included.
  const observer = new MutationObserver(refreshIfCardsChanged);
  observer.observe(grid, { childList: true });
})();
