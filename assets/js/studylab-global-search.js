/* StudyLab site-wide header search.
   Reads only the public static search index generated at deploy time.
   No student history or account data is searched or uploaded. */
(() => {
  "use strict";
  const indexUrl = "assets/data/studylab-search-index.json";
  const suggestions = ["/maths.html","/physics.html","/chemistry.html",
    "/biology.html","/exam-hub.html","/study-tools.html","/study-room.html",
    "/lesson-packs.html"];
  const clean = text => String(text || "").normalize("NFKC").toLocaleLowerCase().trim()
    .replace(/\s+/g," ");
  const allowed = value => {
    if (typeof value !== "string" || !value || /^\/\//.test(value)) return false;
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {return new URL(value).protocol === "https:";} catch (_) {return false;}
  };
  function mount({input,panel,meta}) {
    if (!input || !panel || panel.dataset.globalSearchMounted) return null;
    panel.dataset.globalSearchMounted = "true";
    panel.classList.add("sl-global-search-panel");
    input.setAttribute("role","combobox");
    input.setAttribute("aria-autocomplete","list");
    input.setAttribute("aria-expanded","false");
    input.setAttribute("aria-controls","slGlobalSearchResults");
    input.placeholder="Search StudyLab: simulations, papers, lessons...";
    input.setAttribute("aria-label","Search all StudyLab resources");

    const list = document.createElement("div");
    list.className="sl-global-search-results";
    list.id="slGlobalSearchResults";
    list.setAttribute("role","listbox");
    list.setAttribute("aria-label","StudyLab search results");
    panel.append(list);

    let resources=null;
    let status="not-started";
    let pending=null;
    let visible=[];
    let active=-1;
    let generation=0;

    function message(text) {
      list.replaceChildren();
      const node=document.createElement("p");
      node.className="sl-global-search-message";
      node.textContent=text;
      list.append(node);
    }
    async function load(){
      if(resources) return resources;
      if(pending) return pending;
      status="loading";
      pending=(async()=>{
        try{
          const response=await fetch(indexUrl,{cache:"no-store"});
          if(!response.ok)throw new Error("Index HTTP "+response.status);
          const data=await response.json();
          if(!Array.isArray(data?.resources))throw new Error("Invalid search index");
          resources=data.resources.filter(item=>item&&allowed(item.url)&&item.title)
            .slice(0,1500);
          status="ready";
          return resources;
        }catch(error){
          console.warn("StudyLab global search index:",error?.message||"SEARCH_INDEX_UNAVAILABLE");
          status="error";
          resources=[];
          return resources;
        }finally{pending=null;}
      })();
      return pending;
    }
    function score(item,query) {
      const title=clean(item.title);
      const subject=clean(item.subject);
      const category=clean(item.category);
      const desc=clean(item.description);
      const keywords=clean(item.keywords);
      const all=[title,subject,category,desc,keywords].join(" ");
      const terms=query.split(" ").filter(Boolean);
      if(!terms.every(term=>all.includes(term)))return -1;
      let rank=0;
      if(title===query)rank+=150;
      if(title.startsWith(query))rank+=95;
      else if(title.includes(query))rank+=62;
      if(subject===query)rank+=30;
      if(category.includes(query))rank+=12;
      for(const term of terms) {
        if(title.startsWith(term))rank+=29;
        else if(title.includes(term))rank+=19;
        if(subject.includes(term))rank+=7;
        if(keywords.includes(term))rank+=2;
      }
      if(item.url.startsWith("/tools/"))rank+=4;
      if(item.category==="Subject"||item.category==="Exam Hub")rank+=1;
      return rank;
    }
    function highlight(index){
      const nodes=[...list.querySelectorAll('a[role="option"]')];
      if(!nodes.length)return;
      active=(index+nodes.length)%nodes.length;
      nodes.forEach((node,i)=>{
        node.classList.toggle("is-active",i===active);
        node.setAttribute("aria-selected",String(i===active));
      });
      const chosen=nodes[active];
      input.setAttribute("aria-activedescendant",chosen.id);
      chosen.scrollIntoView({block:"nearest"});
    }
    function draw() {
      const query=clean(input.value);
      const db=resources||[];
      if(status==="loading"){
        meta.textContent="Loading resources...";
        message("Loading StudyLab resources...");
        return;
      }
      if(status==="error"){
        meta.textContent="Search unavailable";
        message("The search index could not load. Please try reopening search.");
        return;
      }
      let matches;
      if(query){
        matches=db.map(item=>({item,rank:score(item,query)}))
          .filter(row=>row.rank>=0)
          .sort((a,b)=>b.rank-a.rank||a.item.title.localeCompare(b.item.title))
          .map(row=>row.item);
        meta.textContent=matches.length+" found";
      }else{
        matches=suggestions.map(url=>db.find(item=>item.url===url)).filter(Boolean);
        meta.textContent=db.length+" resources";
      }
      visible=matches.slice(0,9);
      active=-1;
      input.removeAttribute("aria-activedescendant");
      list.replaceChildren();
      if(!visible.length){
        message(query?"No matching resources. Try another topic.":"No public resources found.");
        return;
      }
      const heading=document.createElement("p");
      heading.className="sl-global-search-results-label";
      heading.textContent=query?"SEARCH RESULTS":"EXPLORE STUDYLAB";
      list.append(heading);
      visible.forEach((item,i)=>{
        const link=document.createElement("a");
        link.className="sl-global-search-result";
        link.id="slGlobalResult"+i;
        link.setAttribute("role","option");
        link.setAttribute("aria-selected","false");
        link.href=item.url;
        if(/^https:\/\//i.test(item.url)){
          link.target="_blank";
          link.rel="noopener noreferrer";
        }
        const icon=document.createElement("span");
        icon.className="sl-global-search-result-icon";
        icon.setAttribute("aria-hidden","true");
        const type=clean(item.category);
        icon.textContent=type.includes("paper")?"▤":
          type.includes("lesson")?"▱":type.includes("simulation")?"✧":
          type.includes("study room")?"◷":"⌕";
        const content=document.createElement("span");
        content.className="sl-global-search-result-copy";
        const title=document.createElement("strong");
        title.textContent=item.title;
        const context=document.createElement("small");
        context.textContent=[item.subject,item.category].filter(Boolean).join(" · ");
        content.append(title,context);
        const arrow=document.createElement("span");
        arrow.className="sl-global-search-result-arrow";
        arrow.textContent="↗";
        arrow.setAttribute("aria-hidden","true");
        link.append(icon,content,arrow);
        link.addEventListener("pointermove",()=>{active=i;});
        list.append(link);
      });
      if(matches.length>visible.length){
        const more=document.createElement("p");
        more.className="sl-global-search-more";
        more.textContent="Showing the closest "+visible.length+" results";
        list.append(more);
      }
    }
    function update(){
      if(status==="not-started"){draw();return;}
      draw();
    }
    function open(){
      generation++;
      if(resources){draw();return;}
      status="loading";
      draw();
      const request=generation;
      load().then(()=>{if(request===generation && !panel.hidden)draw();});
    }
    function reset(){input.value="";update();}
    function close(){generation++;active=-1;input.removeAttribute("aria-activedescendant");}
    input.addEventListener("keydown",event=>{
      if(event.key==="ArrowDown"||event.key==="ArrowUp"){
        if(panel.hidden)return;
        event.preventDefault();
        highlight(active+(event.key==="ArrowDown"?1:-1));
      }else if(event.key==="Enter"&&!panel.hidden&&visible.length){
        event.preventDefault();
        const item=visible[active>=0?active:0];
        const link=[...list.querySelectorAll('a[role="option"]')]
          .find(node=>node.href===new URL(item.url,document.baseURI).href);
        link?.click();
      }else if(event.key==="Escape"){input.removeAttribute("aria-activedescendant");}
    });
    return {open,close,search:update,reset};
  }
  window.StudyLabGlobalSearch=Object.freeze({mount});
})();
