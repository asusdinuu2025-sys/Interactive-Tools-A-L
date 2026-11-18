/* Free Lesson Packs: native in-page subject search and newest-first viewing.
   No database writes, no card cloning, and no changes to the CMS order setting. */
(function () {
  "use strict";
  if (window.StudyLabLessonBrowser) return;
  const main = document.querySelector("main.lesson-page.sl-subject-main");
  const hero = main?.querySelector(".sl-subject-intro-panel");
  const grid = main?.querySelector(".sl-lessons-publisher-grid");
  if (!main || !hero || !grid) return;

  const make = (tag, cls, label) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (label !== undefined) element.textContent = label;
    return element;
  };
  const subjects = [
    ["all","All"],["maths","Maths"],["physics","Physics"],
    ["chemistry","Chemistry"],["biology","Biology"]
  ];
  const state = {subject:"all",search:""};
  const bar = make("nav","sl-lp-filter-bar");
  bar.setAttribute("aria-label","Filter Free Lessons and Lesson Packs");
  const heading = make("span","sl-lp-filter-heading","Filter by Subject");
  const options = make("div","sl-lp-filter-options");
  options.setAttribute("role","group");
  options.setAttribute("aria-label","Lesson subjects");
  const buttons = new Map();
  for (const [subject, label] of subjects) {
    const button = make("button","sl-lp-filter-button",label);
    button.type = "button";
    button.dataset.lpFilter = subject;
    button.setAttribute("aria-pressed",String(subject==="all"));
    button.addEventListener("click",()=>{
      state.subject=subject;
      for (const [key, control] of buttons)
        control.setAttribute("aria-pressed",String(key===subject));
      render();
    });
    buttons.set(subject,button);
    options.append(button);
  }
  const searchLabel = make("label","sl-lp-search");
  const searchIcon = make("span","sl-lp-search-icon");
  searchIcon.setAttribute("aria-hidden","true");
  searchIcon.textContent="⌕";
  const search = make("input");
  search.type = "search";
  search.placeholder="Search lessons, teachers...";
  search.autocomplete="off";
  search.maxLength=140;
  search.setAttribute("aria-label","Search lesson packs by title, description or teacher");
  search.addEventListener("input",()=>{
    state.search=search.value.trim().toLocaleLowerCase();
    render();
  });
  search.addEventListener("keydown",event=>{
    if(event.key==="Escape"){
      search.value="";state.search="";render();
    }
  });
  searchLabel.append(searchIcon,search);
  bar.append(heading,options,searchLabel);
  hero.after(bar);

  const noResults=make("p","sl-lp-no-results","No lesson packs match these filters.");
  noResults.setAttribute("role","status");
  noResults.hidden=true;
  grid.after(noResults);

  function subjectOf(card) {
    const explicit=(card.dataset.lessonSubject||"").trim().toLowerCase();
    if (explicit==="mathematics") return "maths";
    if (subjects.some(([key])=>key===explicit)) return explicit;
    // Built-in lesson cards do not have a CMS subject field.
    const topline=card.querySelector(".sl-lesson-publisher-topline")?.textContent||"";
    const match=topline.match(/\b(MATHEMATICS|MATHS?|PHYSICS|CHEMISTRY|BIOLOGY)\b/i);
    if (!match) return "";
    return /^math/i.test(match[1])?"maths":match[1].toLowerCase();
  }
  const isPublished=card=>card.classList.contains("sl-cms-special");
  function render(){
    const cards=[...grid.querySelectorAll(":scope > .sl-lesson-publisher-card")];
    // Admin's nextOrder gives each new publication a larger number.
    // On this page only, higher order is shown first; built-ins stay after uploads.
    const ordered=cards.map((card,index)=>({
      card,index,
      published:isPublished(card)?1:0,
      order:Number(card.dataset.cmsOrder)||0
    })).sort((a,b)=>
      b.published-a.published || b.order-a.order || a.index-b.index
    ).map(entry=>entry.card);
    if (ordered.some((card,index)=>cards[index]!==card)) grid.append(...ordered);

    let matches=0;
    for (const card of ordered) {
      const allowedSubject=state.subject==="all"||subjectOf(card)===state.subject;
      const allowedText=!state.search||card.textContent.toLocaleLowerCase().includes(state.search);
      const visible=!card.hidden&&allowedSubject&&allowedText;
      card.classList.toggle("sl-lp-filtered-out",!visible);
      if (visible) matches++;
    }
    noResults.hidden=matches!==0;
  }
  window.addEventListener("studylab-content-applied",event=>{
    if (!event.detail?.page || event.detail.page==="lesson-packs.html") render();
  });
  render();
  window.StudyLabLessonBrowser=Object.freeze({refresh:render});
})();
