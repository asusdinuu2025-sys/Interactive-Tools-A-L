/* StudyLab Telegram channel browser: in-page filtering, newest-first ordering,
   sponsored carousel and inline View All. No backend writes or extra API calls. */
(function () {
  "use strict";
  if (window.StudyLabTelegramBrowser) return;

  const labels = [
    ["all", "All"], ["sponsored", "Sponsored"], ["maths", "Maths"],
    ["biology", "Biology"], ["chemistry", "Chemistry"],
    ["physics", "Physics"], ["all-subjects", "All Subjects"]
  ];
  const main = document.querySelector("main.sl-subject-main");
  const hero = main?.querySelector(".sl-subject-intro-panel");
  const featured = main?.querySelector(".telegram-featured-channel");
  const sponsorBadge = main?.querySelector(".telegram-sponsored-bar");
  if (!main || !hero || !featured || !sponsorBadge) return;

  const elem = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const state = {filter: "all", search: "", sponsorIndex: 0, expanded: new Set()};
  let intervalSeconds=2;
  let autoTimer=null;
  let hovering=false,focused=false;
  const reducedMotion=Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const stopAuto=()=>{
    if(autoTimer!==null){window.clearTimeout(autoTimer);autoTimer=null;}
  };
  const sections = new Map();
  const controls = new Map();
  const limit = 4;

  const filterBar = elem("nav", "sl-tg-filter-bar");
  filterBar.setAttribute("aria-label", "Filter Telegram channels");
  const filterHeading = elem("span", "sl-tg-filter-heading", "Filter by Subject");
  const filterOptions = elem("div", "sl-tg-filter-options");
  filterOptions.setAttribute("role", "group");
  filterOptions.setAttribute("aria-label", "Channel categories");
  const buttons = new Map();
  for (const [key, title] of labels) {
    const button = elem("button", "sl-tg-filter-button", title);
    button.type = "button";
    button.dataset.tgFilter = key;
    button.setAttribute("aria-pressed", String(key === "all"));
    button.addEventListener("click", () => {
      state.filter = key;
      state.search = "";
      search.value = "";
      for (const [category, item] of buttons) {
        item.setAttribute("aria-pressed", String(category === key));
      }
      render();
    });
    buttons.set(key, button);
    filterOptions.append(button);
  }
  const searchLabel = elem("label", "sl-tg-search");
  const searchIcon = elem("span", "sl-tg-search-icon", "⌕");
  searchIcon.setAttribute("aria-hidden", "true");
  const search = elem("input");
  search.type = "search";
  search.placeholder = "Search channels...";
  search.autocomplete = "off";
  search.maxLength = 140;
  search.setAttribute("aria-label", "Search channels by name, teacher or username");
  search.addEventListener("input", () => {
    state.search = search.value.trim().toLocaleLowerCase();
    if (state.search) {
      state.filter = "all";
      for (const [category, button] of buttons)
        button.setAttribute("aria-pressed", String(category === "all"));
    }
    render();
  });
  search.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      search.value = ""; state.search = ""; render();
    }
  });
  searchLabel.append(searchIcon, search);
  filterBar.append(filterHeading, filterOptions, searchLabel);
  hero.after(filterBar);

  // The original featured card is kept intact. Move it into the same
  // published-card host so all sponsors can be ordered and shown uniformly.
  const sponsorSection = elem("section", "sl-tg-sponsored-section");
  sponsorSection.dataset.tgCategory = "sponsored";
  sponsorSection.id = "sl-tg-sponsored";
  const sponsorToolbar = elem("div", "sl-tg-sponsored-toolbar");
  const sponsorActions = elem("div", "sl-tg-sponsored-actions");
  const sponsorCount = elem("span", "sl-tg-sponsor-count");
  sponsorCount.setAttribute("aria-live", "polite");
  const previous = elem("button", "sl-tg-carousel-arrow", "‹");
  const next = elem("button", "sl-tg-carousel-arrow", "›");
  for (const [button, direction, label] of [
    [previous, -1, "Previous sponsored channel"],
    [next, 1, "Next sponsored channel"]
  ]) {
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      const length = visibleSponsors().length;
      if (!length) return;
      state.sponsorIndex = (state.sponsorIndex + direction + length) % length;
      render();
    });
  }
  const sponsorMore = elem("button", "sl-tg-view-all", "View All");
  sponsorMore.type = "button";
  sponsorMore.setAttribute("aria-controls", "sl-tg-sponsored-cards");
  sponsorMore.setAttribute("aria-expanded", "false");
  sponsorMore.addEventListener("click", () => {
    if (state.expanded.has("sponsored")) state.expanded.delete("sponsored");
    else state.expanded.add("sponsored");
    render();
  });
  sponsorActions.append(sponsorCount, previous, next, sponsorMore);
  sponsorToolbar.append(sponsorBadge, sponsorActions);
  const sponsorHost = elem("div", "sl-cms-sponsored-grid sl-tg-sponsored-list");
  sponsorHost.dataset.cmsSponsored = "";
  sponsorHost.id = "sl-tg-sponsored-cards";
  const dots = elem("div", "sl-tg-carousel-dots");
  dots.setAttribute("aria-label", "Sponsored channel selection");
  sponsorSection.append(sponsorToolbar, sponsorHost, dots);
  filterBar.after(sponsorSection);
  sponsorHost.append(featured);
  sections.set("sponsored", sponsorSection);

  // Locate existing subject sections; no cards are cloned or recreated.
  for (const section of main.querySelectorAll(".telegram-subject")) {
    const heading = section.querySelector(".telegram-subject-head h2")?.textContent?.trim().toLowerCase() || "";
    const key = heading.includes("mathematics") ? "maths" :
      heading.includes("biology") ? "biology" :
      heading.includes("chemistry") ? "chemistry" :
      heading.includes("physics") ? "physics" : "";
    if (!key) continue;
    section.dataset.tgCategory = key;
    section.id = "sl-tg-" + key;
    sections.set(key, section);
    addViewAll(section, section.querySelector(".telegram-subject-head"), key);
  }
  const allSubjects = main.querySelector(".telegram-all");
  if (allSubjects) {
    allSubjects.dataset.tgCategory = "all-subjects";
    allSubjects.id = "sl-tg-all-subjects";
    sections.set("all-subjects", allSubjects);
    addViewAll(allSubjects, allSubjects.querySelector(".telegram-all-head"), "all-subjects");
  }

  const noResults = elem("p", "sl-tg-no-results", "No matching Telegram channels found.");
  noResults.hidden = true;
  sponsorSection.after(noResults);

  function addViewAll(section, heading, key) {
    if (!heading) return;
    const button = elem("button", "sl-tg-view-all", "View All");
    button.type = "button";
    button.setAttribute("aria-controls", "sl-tg-" + key);
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      if (state.expanded.has(key)) state.expanded.delete(key);
      else state.expanded.add(key);
      render();
    });
    heading.append(button);
    controls.set(key, button);
  }

  const cardsOf = key => {
    const section = sections.get(key);
    if (!section) return [];
    if (key === "sponsored")
      return [...sponsorHost.querySelectorAll(":scope > .telegram-featured-channel")];
    if (key === "all-subjects")
      return [...section.querySelectorAll(".telegram-all-grid > .telegram-all-channel")];
    return [...section.querySelectorAll(":scope > .telegram-channel")];
  };
  const isPublished = card => card.classList.contains("sl-cms-special");
  function reorder(key) {
    const cards = cardsOf(key);
    if (!cards.length) return cards;
    const parent = cards[0].parentElement;
    const sorted = cards.map((card, i) => ({card, i})).sort((a, b) => {
      if (isPublished(a.card) !== isPublished(b.card))
        return isPublished(a.card) ? -1 : 1;
      if (isPublished(a.card) && isPublished(b.card)) {
        const diff = Number(b.card.dataset.cmsOrder || 0) -
          Number(a.card.dataset.cmsOrder || 0);
        if (diff) return diff;
      }
      // Keep the original, hand-curated static channel order unchanged.
      const diff = Number(a.card.dataset.cmsOrder || 0) -
        Number(b.card.dataset.cmsOrder || 0);
      return diff || a.i - b.i;
    }).map(x => x.card);
    if (sorted.some((card, i) => card !== cards[i])) {
      // Reordering DOM children also preserves the keyboard/tab sequence.
      for (const card of sorted) parent.append(card);
    }
    return sorted;
  }
  function matches(card) {
    if (!state.search) return true;
    const link = card.querySelector("a[href]")?.getAttribute("href") ||
      card.getAttribute("href") || "";
    return (card.textContent + " " + link + " " +
      (card.dataset.tgSearch || "")).toLocaleLowerCase().includes(state.search);
  }
  function visibleSponsors() {
    return cardsOf("sponsored").filter(card => !card.hidden && matches(card));
  }
  function scheduleAuto(){
    stopAuto();
    const allowed=(state.filter==="all"||state.filter==="sponsored") &&
      !state.search && !state.expanded.has("sponsored") &&
      !document.hidden && !hovering && !focused && !reducedMotion;
    if(!allowed||visibleSponsors().length<2)return;
    autoTimer=window.setTimeout(()=>{
      autoTimer=null;
      const length=visibleSponsors().length;
      if(length<2)return;
      state.sponsorIndex=(state.sponsorIndex+1)%length;
      render();
    },intervalSeconds*1000);
  }
  function setAutoAdvanceSeconds(value){
    const parsed=Number(value);
    intervalSeconds=Number.isInteger(parsed)&&parsed>=2&&parsed<=60?parsed:2;
    render();
  }
  function updateDots(list, active) {
    dots.replaceChildren();
    if (list.length < 2 || state.expanded.has("sponsored") || state.search) {
      dots.hidden = true;
      return;
    }
    dots.hidden = false;
    list.forEach((card, i) => {
      const button = elem("button", "sl-tg-carousel-dot");
      button.type = "button";
      button.setAttribute("aria-label", "Show sponsored channel " + (i + 1));
      button.setAttribute("aria-pressed", String(i === active));
      button.addEventListener("click", () => {
        state.sponsorIndex = i;
        render();
      });
      dots.append(button);
    });
  }
  function render() {
    const searching = !!state.search;
    let matchesCount = 0;
    for (const [key, section] of sections) {
      const cards = reorder(key);
      const categoryAllowed = state.filter === "all" || state.filter === key;
      const eligible = cards.filter(card => !card.hidden && matches(card));
      const expanded = state.expanded.has(key);
      section.classList.toggle("sl-tg-section-expanded", expanded);
      if (key === "sponsored") {
        const index = Math.min(state.sponsorIndex, Math.max(0,eligible.length-1));
        state.sponsorIndex = index;
        cards.forEach(card => card.classList.toggle("sl-tg-filtered-out",
          !categoryAllowed || !eligible.includes(card) ||
          (!expanded && !searching && eligible[index] !== card)));
        const carousel = !expanded && !searching && eligible.length > 1;
        previous.hidden = next.hidden = !categoryAllowed || !carousel;
        sponsorCount.hidden = !categoryAllowed || !carousel;
        sponsorCount.textContent = eligible.length ? (index + 1) + " / " + eligible.length : "";
        sponsorMore.hidden = !categoryAllowed || searching || eligible.length <= 1;
        sponsorMore.textContent = expanded ? "Show Less" : "View All";
        sponsorMore.setAttribute("aria-expanded", String(expanded));
        updateDots(eligible,index);
        dots.hidden = dots.hidden || !categoryAllowed;
      } else {
        const control = controls.get(key);
        const visibleLimit = searching || expanded ? Number.POSITIVE_INFINITY : limit;
        let shown = 0;
        for (const card of cards) {
          const allowed = categoryAllowed && !card.hidden && matches(card);
          const visible = allowed && shown < visibleLimit;
          card.classList.toggle("sl-tg-filtered-out", !visible);
          if (visible) shown++;
        }
        if (control) {
          control.hidden = !categoryAllowed || searching || eligible.length <= limit;
          control.textContent = expanded ? "Show Less" : "View All";
          control.setAttribute("aria-expanded", String(expanded));
        }
      }
      section.hidden = !categoryAllowed || (searching && !eligible.length);
      if (categoryAllowed) matchesCount += eligible.length;
    }
    noResults.hidden = !searching || matchesCount !== 0;
    scheduleAuto();
  }
  // Do not move a carousel while someone is interacting with its content.
  sponsorSection.addEventListener("mouseenter",()=>{hovering=true;stopAuto();});
  sponsorSection.addEventListener("mouseleave",()=>{hovering=false;scheduleAuto();});
  sponsorSection.addEventListener("focusin",()=>{focused=true;stopAuto();});
  sponsorSection.addEventListener("focusout",event=>{
    if(!event.relatedTarget||!sponsorSection.contains(event.relatedTarget)){
      focused=false;scheduleAuto();
    }
  });
  document.addEventListener("visibilitychange",scheduleAuto);
  window.addEventListener("pagehide",stopAuto,{once:true});
  sponsorSection.addEventListener("keydown", event => {
    if (event.target.closest("button,a,input")) return;
    if (event.key === "ArrowLeft") previous.click();
    if (event.key === "ArrowRight") next.click();
  });
  window.addEventListener("studylab-content-applied", () => {
    // The CMS may add/re-render a card after this page is first built.
    state.sponsorIndex = 0;
    render();
  });
  render();
  window.StudyLabTelegramBrowser = Object.freeze({refresh:render,setAutoAdvanceSeconds,
    getAutoAdvanceSeconds:()=>intervalSeconds});
})();