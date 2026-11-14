/* Minimal read-only past-paper finder. Never invent medium/source metadata. */
(() => {
  "use strict";
  const heading = document.getElementById("past-papers-heading");
  if (!heading || document.getElementById("slPaperFinder")) return;
  const subjects = {
    "Combined Mathematics": "tools/Maths/Maths_Past_Papers.html",
    "Physics": "tools/physics/Physics_Past_Papers.html",
    "Chemistry": "tools/chemistry/Chemistry_Past_Papers.html",
    "Biology": "tools/Biology/Biology_Past_Papers.html",
    "General English": "generalenglish.html",
    "General Common Test": "generalknowledge.html",
    "General Information Technology": "git.html"
  };
  const form = document.createElement("form");
  form.id = "slPaperFinder";
  form.className = "sl-paper-finder";
  form.setAttribute("aria-label", "Find A/L past papers");
  form.innerHTML = '<label>Subject<select id="slPaperSubject"></select></label>'+
    '<label>Year<select id="slPaperYear"></select></label>'+
    '<label>Medium<select id="slPaperMedium"><option value="all">Any / check source</option><option value="sinhala">Sinhala</option><option value="tamil">Tamil</option><option value="english">English</option></select></label>'+
    '<button type="submit">Find papers</button>'+
    '<p class="sl-paper-result" id="slPaperResult" role="status" aria-live="polite"></p>';
  const selector = form.querySelector("#slPaperSubject");
  for (const name of Object.keys(subjects)) {
    const option = document.createElement("option"); option.value = name; option.textContent = name; selector.append(option);
  }
  const yearSelect = form.querySelector("#slPaperYear");
  for (let year = 2026; year >= 1990; year--) {
    const option = document.createElement("option"); option.value = String(year); option.textContent = String(year); yearSelect.append(option);
  }
  yearSelect.value = "2025";
  const style = document.createElement("style");
  style.textContent = '.sl-paper-finder{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;margin:0 0 14px;padding:12px;border:1px solid var(--card-border);border-radius:13px;background:var(--card-bg)}.sl-paper-finder label{display:grid;gap:5px;font-size:.74rem;color:var(--text-secondary)}.sl-paper-finder select{min-height:39px;min-width:125px;max-width:100%;padding:7px 10px;border-radius:9px;border:1px solid var(--card-border);background:var(--bg-mid);color:var(--text-primary);font:inherit}.sl-paper-finder button{min-height:39px;padding:7px 13px;border-radius:9px;border:1px solid var(--card-border);background:var(--card-bg);color:var(--text-primary);font:inherit;cursor:pointer}.sl-paper-result{flex-basis:100%;margin:0;font-size:.78rem;color:var(--text-secondary);line-height:1.6}.sl-paper-result a{color:var(--accent-cyan);text-decoration:underline}.sl-paper-finder :focus-visible{outline:2px solid var(--accent-cyan);outline-offset:2px}@media(max-width:420px){.sl-paper-finder label{flex:1 1 115px}.sl-paper-finder button{width:100%}}';
  document.head.append(style);
  heading.insertAdjacentElement("afterend", form);
  function mediumFromText(text) {
    const t = String(text || "").toLowerCase();
    if (/sinhala\s*medium|සිංහල\s*මාධ්‍ය/i.test(t)) return "sinhala";
    if (/tamil\s*medium|தமிழ்\s*வழி/i.test(t)) return "tamil";
    if (/english\s*medium/i.test(t)) return "english";
    return "unknown";
  }
  let currentRequest = 0;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const seq = ++currentRequest, subjectName = selector.value;
    const page = subjects[subjectName], year = yearSelect.value;
    const medium = form.querySelector("#slPaperMedium").value;
    const result = form.querySelector("#slPaperResult");
    result.replaceChildren();
    result.textContent = "Checking the StudyLab paper index…";
    try {
      const response = await fetch(page, {cache:"no-store"});
      if (!response.ok) throw new Error("The paper index is unavailable.");
      const html = await response.text();
      if (seq !== currentRequest) return;
      const doc = new DOMParser().parseFromString(html, "text/html");
      const candidates = [...doc.querySelectorAll("a[href]")].filter(a => {
        const yearPattern = new RegExp("(^|\\D)" + year + "(\\D|$)");
        return yearPattern.test(a.textContent || "") &&
          (a.closest(".tool-card") || /paper|pdf/i.test(a.textContent || ""));
      });
      if (!candidates.length) {
        result.textContent = "No " + year + " paper link is listed in the StudyLab " + subjectName + " collection.";
        return;
      }
      const verified = candidates.filter(a => medium === "all" || mediumFromText(a.textContent + " " + a.closest(".tool-card")?.textContent) === medium);
      const entries = medium === "all" ? candidates : verified;
      if (!entries.length) {
        result.textContent = "A " + year + " paper is listed, but its language medium is not identified by the source. Choose Any to open the original listing and check the medium there.";
        return;
      }
      result.textContent = entries.length + " paper link(s) in the " + subjectName + " collection. StudyLab index checked " + new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Colombo",day:"numeric",month:"short",year:"numeric"}).format(new Date()) + ". External PDF contents are not independently verified. ";
      const list = document.createElement("span");
      entries.slice(0,8).forEach((a,i)=>{
        const link = document.createElement("a");
        link.href = new URL(a.getAttribute("href"), new URL(page, document.baseURI)).href;
        link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = (i ? " · " : "") + "Open " + year + " paper";
        list.append(link);
      });
      result.append(list);
    } catch(error) {
      if (seq === currentRequest) result.textContent = error.message || "Could not check paper links. Try opening the subject collection directly.";
    }
  });
})();
