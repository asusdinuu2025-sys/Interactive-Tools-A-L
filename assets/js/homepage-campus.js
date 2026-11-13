/* StudyLab Campus homepage shell.
   Uses the existing account, profile, search, Social, AI and PWA controls. */
(() => {
  "use strict";
  const body = document.body;
  if (!body || body.classList.contains("studylab-campus")) return;
  body.classList.add("studylab-campus");

  const navItems = [
    { id:"overview", icon:"⌂", label:"Overview" },
    { id:"subjects", icon:"◈", label:"Subjects" },
    { id:"learning", icon:"▤", label:"Learning Library" },
    { id:"subjects", icon:"⚗", label:"Practical Lab" },
    { id:"productivity", icon:"◷", label:"Productivity" },
    { id:"community", icon:"◎", label:"Community" },
    { id:"assistance", icon:"✧", label:"AI Assistant" }
  ];

  const sidebar = document.createElement("aside");
  sidebar.className = "sl-campus-sidebar";
  sidebar.setAttribute("aria-label","StudyLab workspace navigation");
  sidebar.innerHTML = `
    <div class="sl-campus-side-label">YOUR WORKSPACE</div>
    <nav class="sl-campus-nav" aria-label="Main navigation">
      ${navItems.map((item,index)=>`<a href="#${item.id}" ${index===0?'aria-current="page"':''}><span class="sl-campus-nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></a>`).join("")}
    </nav>
    <div class="sl-campus-sidebar-bottom"><strong>Your A/L journey</strong><span>One space for learning, practice and progress.</span></div>
  `;
  body.prepend(sidebar);

  const mobileNav = document.createElement("nav");
  mobileNav.className = "sl-campus-mobile-nav";
  mobileNav.setAttribute("aria-label","Mobile navigation");
  const mobileItems = [
    {id:"overview",icon:"⌂",label:"Home"},
    {id:"subjects",icon:"◈",label:"Subjects"},
    {id:"learning",icon:"▤",label:"Learn"},
    {id:"productivity",icon:"◷",label:"Focus"},
    {id:"community",icon:"◎",label:"Social"}
  ];
  mobileNav.innerHTML = mobileItems.map((item,index)=>`<a href="#${item.id}" ${index===0?'aria-current="page"':''}><span aria-hidden="true">${item.icon}</span><span>${item.label}</span></a>`).join("");
  body.append(mobileNav);

  const header = document.querySelector(".site-header");
  if (header) {
    const brandText = header.querySelector(".brand > span:last-child");
    if (brandText) brandText.textContent = "StudyLab";
    const topLinks = document.createElement("nav");
    topLinks.className = "sl-campus-toplinks";
    topLinks.setAttribute("aria-label","Quick navigation");
    topLinks.innerHTML = '<a href="#subjects">Subjects</a><a href="#learning">Resources</a><a href="#productivity">Study Room</a>';
    const actions = header.querySelector(".header-actions");
    if (actions) header.insertBefore(topLinks,actions);
  }

  const oldNav = document.querySelector(".home-primary-nav");
  if (oldNav) oldNav.remove();

  const hero = document.querySelector(".hero#overview");
  if (hero) {
    const eyebrow = hero.querySelector(".home-hero-eyebrow");
    const heading = hero.querySelector("h1");
    const subtitle = hero.querySelector(".subtitle");
    if (eyebrow) eyebrow.textContent = "YOUR STUDYLAB CAMPUS";
    if (heading) {
      heading.id = "campusGreeting";
      heading.textContent = "Welcome to your learning space.";
      heading.setAttribute("aria-live","polite");
    }
    if (subtitle) subtitle.textContent = "Your personal A/L workspace is ready. Explore your subjects, build your understanding and make every study session count.";
    const actions = document.createElement("div");
    actions.className = "sl-campus-hero-actions";
    actions.innerHTML = '<a href="#subjects">Explore subjects <span aria-hidden="true">↗</span></a><a class="secondary" href="study-room.html?completeProfile=1&amp;returnTo=%2Fstudy-room.html">Enter Study Room <span aria-hidden="true">↗</span></a>';

    const copy = document.createElement("div");
    copy.className = "sl-campus-hero-copy";
    hero.insertBefore(copy,hero.firstChild);
    [eyebrow,heading,subtitle,actions].filter(Boolean).forEach(node=>copy.append(node));

    const art = document.createElement("div");
    art.className = "sl-campus-hero-art";
    art.setAttribute("aria-hidden","true");
    art.innerHTML = '<div class="sl-campus-orbit"></div><div class="sl-campus-hero-core"><svg viewBox="0 0 72 72"><path d="M9 24 36 11l27 13-27 13L9 24Z"/><path d="M18 29v16c10 9 26 9 36 0V29M63 24v19"/><path d="M27 42v9m18-9v9"/></svg></div><div class="sl-campus-float-chip one">✦ Learn</div><div class="sl-campus-float-chip two">⚗ Explore</div><div class="sl-campus-float-chip three">◷ Focus</div>';
    const utility = hero.querySelector(".homepage-utility-row");
    hero.append(art);
    if (utility) hero.append(utility);
  }

  const greeting = document.getElementById("campusGreeting");
  function greetingText(name) {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const clean = String(name || "").trim().replace(/\s+/g," ");
    const usable = clean && !/^Student\d{4}$/i.test(clean) ? clean.split(" ")[0] : "";
    return usable ? `${timeGreeting}, ${usable}.` : "Welcome to StudyLab.";
  }
  function updateGreeting(profile) {
    if (!greeting) return;
    const account = window.StudyLabAccount;
    const name = profile?.display_name || account?.getSuggestedDisplayName?.() || "";
    greeting.textContent = greetingText(name);
  }
  updateGreeting(null);
  window.addEventListener("studylab-profile-updated",event=>updateGreeting(event.detail));
  window.addEventListener("studylab-account-ready",()=>updateGreeting(window.StudyLabAccount?.getProfile?.()));
  if (window.StudyLabAccount?.ready) {
    window.StudyLabAccount.ready.then(async()=>{
      try {
        const profile = await window.StudyLabAccount.getProfile?.();
        updateGreeting(profile);
      } catch (_) { updateGreeting(null); }
    }).catch(()=>updateGreeting(null));
  }

  // Keep the original Study Room card and its exact destination, but surface it with the live dashboard metrics.
  const utilityRow = document.querySelector(".homepage-utility-row");
  const studyRoomCard = document.querySelector(".home-hub-grid--productivity > .study-room-launcher");
  if (utilityRow && studyRoomCard) utilityRow.append(studyRoomCard);

  const allNavLinks = [...sidebar.querySelectorAll("a"),...mobileNav.querySelectorAll("a")];
  const sections = ["overview","subjects","learning","productivity","community","assistance"]
    .map(id=>document.getElementById(id)).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries=>{
      const visible = entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      allNavLinks.forEach(link=>{
        const active = link.getAttribute("href") === "#"+visible.target.id;
        if (active) link.setAttribute("aria-current","page");
        else link.removeAttribute("aria-current");
      });
    },{rootMargin:"-22% 0px -62% 0px",threshold:[0,.15,.35,.6]});
    sections.forEach(section=>observer.observe(section));
  }

  document.addEventListener("click",event=>{
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-home-social-open]")) {
      document.querySelector(".sl-feed-toggle")?.click();
    }
    if (target?.closest("[data-home-ai-open]")) {
      document.querySelector("[data-ai-launcher]")?.click();
    }
  });
})();
