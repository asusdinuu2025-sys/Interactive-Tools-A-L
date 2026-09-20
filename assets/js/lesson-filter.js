/*
 * Study-Lab automatic subject filter
 *
 * Chemistry / Biology / Physics:
 *   All → Lesson 01... → Resources → Past Papers
 *
 * Maths:
 *   All → Pure → Applied → Resources → Past Papers
 *
 * Cards are classified automatically from their visible text.
 * No data-category/data-lesson attribute is required.
 */
(function () {
  "use strict";

  const root = document.getElementById("lessonFilter");
  const grid = document.querySelector(".tool-grid");
  const subject = document.body.dataset.filterSubject;

  if (!root || !grid || !subject) return;

  const isMaths = subject === "maths";

  const maxLessons = {
    chemistry: 14,
    biology: 10,
    physics: 11
  }[subject];

  if (!isMaths && !maxLessons) return;

  const cardText = card => card.textContent.replace(/\s+/g, " ").trim();

  function unique(values) {
    return [...new Set(values)];
  }

  function getLessonNumbers(text) {
    if (isMaths || !maxLessons) return [];

    const found = [];
    let match;

    const lessonPattern = /\blesson\s*(0?[1-9]|1[0-9])\b/gi;
    while ((match = lessonPattern.exec(text)) !== null) {
      found.push(Number(match[1]));
    }

    const numberedPattern = /(?:^|\s)(0?[1-9]|1[0-9])\s*[.\/:\-]\s*/g;
    while ((match = numberedPattern.exec(text)) !== null) {
      found.push(Number(match[1]));
    }

    // Backward compatibility for older Chemistry cards.
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

  function getMathsCategory(text, lessons) {
    const isPastPaper = /past\s*papers?|past\s*paper|pastpaper/i.test(text);

    if (isPastPaper) return "pastpapers";

    // Explicit Applied labels always take priority.
    if (/\bapplied\b|applied\s*mathematics|ව්‍යවහාරික|යෙදුම්/i.test(text)) {
      return "applied";
    }

    // Existing/current numbered Maths lesson cards are Pure.
    if (lessons || /(?:^|\s)(0?[1-9]|[12][0-9]|3[0-9])\s*[.\/:\-]\s*/.test(text)) {
      return "pure";
    }

    return "resource";
  }

  function getCards() {
    return [...grid.querySelectorAll(":scope > .tool-card")].map(element => {
      const text = cardText(element);
      const lessons = getLessonNumbers(text);
      const isPastPaper = /past\s*papers?|past\s*paper|pastpaper/i.test(text);

      if (isMaths) {
        return {
          element,
          text,
          lessons: [],
          isPastPaper,
          type: getMathsCategory(text, lessons)
        };
      }

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

    if (isMaths) {
      return cards.filter(card => card.type === filterId).length;
    }

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

    if (isMaths) {
      const mathsLabels = {
        pure: "Pure",
        applied: "Applied",
        resource: "Resources",
        pastpapers: "Past Papers"
      };
      return mathsLabels[filterId] || "Filter";
    }

    if (filterId === "resources") return "Resources";
    if (filterId === "pastpapers") return "Past Papers";

    const lesson = Number(filterId.replace("lesson-", ""));
    return "Lesson " + String(lesson).padStart(2, "0");
  }

  function menuOptions() {
    if (isMaths) {
      return [
        { id: "all", label: "All" },
        { id: "pure", label: "Pure" },
        { id: "applied", label: "Applied" },
        { id: "resource", label: "Resources" },
        { id: "pastpapers", label: "Past Papers" }
      ];
    }

    return [
      { id: "all", label: "All" },
      ...Array.from({ length: maxLessons }, (_, index) => {
        const lesson = index + 1;
        return {
          id: "lesson-" + lesson,
          label: "Lesson " + String(lesson).padStart(2, "0")
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
        '<span class="lesson-filter-option-label">' + option.label + "</span>" +
        '<span class="lesson-filter-option-count">[' +
        countFor(option.id) +
        ' cards]</span>';

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
    current.textContent = labelFor(activeFilter);
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
      let visible = false;

      if (filterId === "all") {
        visible = true;
      } else if (isMaths) {
        visible = card.type === filterId;
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

      if (!menuOptions().some(option => option.id === activeFilter)) {
        activeFilter = "all";
      }

      render();
      applyFilter(activeFilter);
    }
  }

  lastSignature = cardSignature();
  render();
  applyFilter("all");

  // Future cards are automatically reclassified from their visible text.
  const observer = new MutationObserver(refreshIfCardsChanged);
  observer.observe(grid, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
