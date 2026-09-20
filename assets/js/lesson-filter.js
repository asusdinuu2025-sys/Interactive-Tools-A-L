/*
 * Study-Lab automatic lesson/type filter
 * Cards are classified from their visible title/description.
 * No data-category attribute is required.
 */
(function () {
  "use strict";

  const root = document.getElementById("lessonFilter");
  const grid = document.querySelector(".tool-grid");
  const subject = document.body.dataset.filterSubject;

  if (!root || !grid || !subject) return;

  const config = {
    chemistry: { maxLessons: 14, label: "Chemistry" },
    biology: { maxLessons: 10, label: "Biology" },
    physics: { maxLessons: 11, label: "Physics" },
    maths: { maxLessons: 0, label: "Mathematics" }
  }[subject];

  if (!config) return;

  const pureHints = [
    "trigonametry", "trigonometry", "ත්‍රිකෝණමිතීය",
    "differentiation", "අවකලනය",
    "integration", "අනුකලනය",
    "complex number", "complex numbers", "සංකීර්ණ සංඛ්‍යා",
    "pure mathematics", "pure maths", "ශුද්ධ ගණිත"
  ];

  const appliedHints = [
    "applied mathematics", "applied maths", "ව්‍යවහාරික ගණිත",
    "mechanics", "statics", "dynamics", "probability",
    "statistics", "distribution", "kinematics", "projectile",
    "friction", "moment", "moments"
  ];

  function getText(card) {
    return card.textContent.replace(/\s+/g, " ").trim().toLowerCase();
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function getLessonNumbers(text) {
    const found = [];

    const lessonWords = /\blesson\s*(0?[1-9]|1[0-4])\b/gi;
    let match;
    while ((match = lessonWords.exec(text)) !== null) {
      found.push(Number(match[1]));
    }

    const numbered = /\b(0?[1-9]|1[0-4])\s*[.\/:\-]\s*/g;
    while ((match = numbered.exec(text)) !== null) {
      found.push(Number(match[1]));
    }

    // Chemistry cards that were created before lesson numbers were added.
    if (subject === "chemistry") {
      const chemistryRules = [
        {
          lessons: [5],
          pattern: /energetics|ශක්ති\s*විද්‍යාව|enthalpy|thermochem/
        },
        {
          lessons: [6],
          pattern: /nh3|nh₃|cation|කැටායන|fe²|fe3|fe³|h2so4|h₂so₄|anion|ඇනායන|flame|පහන්\s*සිළු|inorganic|අකාබනික|කාණ්ඩ\s*විශ්ලේෂණ/
        },
        {
          lessons: [11],
          pattern: /kinetic|kinetics|චාලක\s*රසායනය/
        },
        {
          lessons: [12],
          pattern: /equilibrium|සමතුලිතතාවය|සමතුලිත/
        }
      ];

      chemistryRules.forEach(rule => {
        if (rule.pattern.test(text)) found.push(...rule.lessons);
      });
    }

    return unique(found.filter(n => n >= 1 && n <= config.maxLessons));
  }

  function classify(card) {
    const text = getText(card);

    if (/past\s*papers?|past\s*paper|pastpaper/.test(text)) {
      return { lessons: [], types: [], resource: true };
    }

    if (subject === "maths") {
      const types = [];

      if (/\bpure\b|pure\s+mathematics|ශුද්ධ\s+ගණිත/.test(text) ||
          pureHints.some(hint => text.includes(hint))) {
        types.push("pure");
      }

      if (/\bapplied\b|applied\s+mathematics|ව්‍යවහාරික\s+ගණිත/.test(text) ||
          appliedHints.some(hint => text.includes(hint))) {
        types.push("applied");
      }

      return { lessons: [], types: unique(types), resource: false };
    }

    return {
      lessons: getLessonNumbers(text),
      types: [],
      resource: false
    };
  }

  function collectCards() {
    return [...grid.querySelectorAll(":scope > .tool-card")].map(card => ({
      element: card,
      meta: classify(card)
    }));
  }

  let cards = collectCards();

  const filters = [];
  filters.push({ id: "all", label: "All" });

  if (subject === "maths") {
    filters.push(
      { id: "pure", label: "Pure" },
      { id: "applied", label: "Applied" }
    );
  } else {
    for (let i = 1; i <= config.maxLessons; i++) {
      filters.push({
        id: "lesson-" + i,
        label: "Lesson " + String(i).padStart(2, "0")
      });
    }
  }

  filters.push({ id: "resources", label: "Resources" });

  function countFor(id) {
    if (id === "all") return cards.length;
    if (id === "resources") {
      return cards.filter(item => item.meta.resource).length;
    }

    if (subject === "maths") {
      return cards.filter(item =>
        !item.meta.resource && item.meta.types.includes(id)
      ).length;
    }

    const lesson = Number(id.replace("lesson-", ""));
    return cards.filter(item =>
      !item.meta.resource && item.meta.lessons.includes(lesson)
    ).length;
  }

  function renderButtons() {
    root.innerHTML = "";

    const title = document.createElement("div");
    title.className = "lesson-filter-title";
    title.textContent = subject === "maths"
      ? "Filter by type"
      : "Filter by lesson";
    root.appendChild(title);

    const buttons = document.createElement("div");
    buttons.className = "lesson-filter-buttons";

    filters.forEach(filter => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lesson-filter-button";
      button.dataset.filter = filter.id;
      button.innerHTML =
        "<span>" + filter.label + "</span>" +
        '<span class="lesson-filter-count">' + countFor(filter.id) + "</span>";

      button.addEventListener("click", () => applyFilter(filter.id));
      buttons.appendChild(button);
    });

    root.appendChild(buttons);
  }

  function applyFilter(id) {
    buttonsSetActive(id);

    cards.forEach(item => {
      const { meta, element } = item;
      let visible = false;

      if (id === "all") {
        visible = true;
      } else if (id === "resources") {
        visible = meta.resource;
      } else if (subject === "maths") {
        visible = !meta.resource && meta.types.includes(id);
      } else {
        const lesson = Number(id.replace("lesson-", ""));
        visible = !meta.resource && meta.lessons.includes(lesson);
      }

      element.hidden = !visible;
    });
  }

  function buttonsSetActive(id) {
    root.querySelectorAll(".lesson-filter-button").forEach(button => {
      const active = button.dataset.filter === id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function refresh() {
    cards = collectCards();
    renderButtons();
    applyFilter(
      root.querySelector(".lesson-filter-button.active")?.dataset.filter || "all"
    );
  }

  renderButtons();
  applyFilter("all");

  // Automatically notice cards added later to the page.
  const observer = new MutationObserver(() => {
    const latestCount = grid.querySelectorAll(":scope > .tool-card").length;
    if (latestCount !== cards.length) refresh();
  });

  observer.observe(grid, { childList: true });
})();
