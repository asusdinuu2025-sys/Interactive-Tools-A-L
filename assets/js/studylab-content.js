/* Published overrides enhance existing markup; failures leave original content intact. */
(function () {
  "use strict";
  const config = window.StudyLabAdminConfig || {mode:"preview"};
  const page = location.pathname.split("/").pop() || "index.html";
  function safeURL(raw, image = false) {
    try {
      raw = String(raw || "").trim();
      if (!raw) return null;
      if (
        config.mode === "preview" &&
        /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[a-z0-9+/=]+$/i.test(raw)
      ) return raw;
      if (/[\u0000-\u0020\u007f\\]/.test(raw) || raw.startsWith("//"))
        return null;
      if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) &&
          !/^(?:[./?#]|[\w-]+\.html(?:[?#]|$))/i.test(raw) &&
          /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::[0-9]{2,5})?(?:[/?#]|$)/i.test(raw))
        raw = "https://" + raw;
      const u = new URL(raw, location.href);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
        return null;
      if (image && u.origin !== location.origin && u.protocol !== "https:")
        return null;
      return u.href;
    } catch {
      return null;
    }
  }
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  function apply(records) {
    const items = records.filter((x) => x.page === page);
    // A deleted built-in card remains in static HTML. The server sends only
    // its tiny tombstone, which permanently hides that element on refresh.
    for (const d of items.filter((x) => x.deleted === true)) {
      const target = document.querySelector(
        '[data-cms-id="' + CSS.escape(d.id) + '"]',
      );
      if (target) target.hidden = true;
      document.querySelectorAll(
        '[data-home-nav="' + CSS.escape(d.id) + '"]',
      ).forEach((link) => { link.hidden = true; });
    }
    for (const d of items.filter((x) => !x.deleted && x.kind === "section")) {
      let section = document.querySelector(
        '[data-cms-id="' + CSS.escape(d.id) + '"]',
      );
      if (!section) {
        section = el("section", "sl-cms-section");
        section.id = d.id;
        section.dataset.cmsId = d.id;
        section.append(el("h2"), el("p"), el("div", "sl-cms-grid"));
        document.querySelector("main")?.append(section);
      }
      section.hidden = !!d.hidden;
      section.dataset.layout = d.layout || "cards";
      const title = section.querySelector("h2"),
        desc =
          section.querySelector("header p") ||
          section.querySelector(":scope > p");
      if (title) title.textContent = d.title;
      if (desc) desc.textContent = d.description || "";
      section.dataset.cmsOrder = d.order;
      document
        .querySelectorAll(
          'a[href="#' +
            CSS.escape(d.id) +
            '"], [data-home-nav="' +
            CSS.escape(d.id) +
            '"]',
        )
        .forEach((n) => (n.hidden = !!d.hidden));
    }
    for (const d of items.filter((x) => !x.deleted && x.kind === "card")) {
      let card = document.querySelector(
        '[data-cms-id="' + CSS.escape(d.id) + '"]',
      );
      // Older published simulations were incorrectly treated as external
      // .html domains. Their verified content ID defines the local viewer URL.
      const destination = d.resource_type === "simulation"
        ? "/simulation-viewer.html?id=" + encodeURIComponent(d.id)
        : d.url;
      const href = safeURL(destination);
      if (!href) continue;
      // Specialized admin resources use native subject/Telegram/lesson cards.
      // Generic cards and custom sections continue through the old renderer.
      if (window.StudyLabSpecialResources?.apply(d,href)) continue;
      if (!card) {
        card = el("a", "sl-cms-card");
        card.dataset.cmsId = d.id;
        card.append(el("h3"), el("p"), el("span", "sl-cms-open", "Open resource"));
        let host = d.section
          ? document
              .getElementById(d.section)
              ?.querySelector(".sl-cms-grid,.card-grid")
          : null;
        if (!host) {
          host = document.querySelector("[data-cms-additions]");
          if (!host) {
            const wrapper = el("section", "sl-cms-section");
            wrapper.append(
              el(
                "h2",
                null,
                page === "index.html"
                  ? "More learning resources"
                  : "Additional resources",
              ),
            );
            host = el("div", "sl-cms-grid");
            host.dataset.cmsAdditions = "true";
            wrapper.append(host);
            document.querySelector("main")?.append(wrapper);
          }
        }
        host.append(card);
      }
      card.hidden = !!d.hidden;
      card.href = href;
      card.setAttribute("aria-label", d.title);
      if (new URL(href, location.href).origin !== location.origin) {
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      } else {
        card.removeAttribute("target");
      }
      const title = card.querySelector(
          "h2,h3,.sl-lesson-publisher-title,strong",
        ),
        desc =
          card.querySelector("p,.sl-lesson-publisher-description") ||
          card.querySelector("strong")?.nextElementSibling;
      if (title) title.textContent = d.title;
      if (desc) desc.textContent = d.description || "";
      card.dataset.cmsOrder = d.order;
      const open = card.querySelector(".sl-cms-open");
      if (open) {
        const label = String(d.button_label || "Open resource").trim();
        open.textContent = label.slice(0, 22) || "Open resource";
      }
      let img = card.querySelector(".sl-cms-image");
      if (d.image && safeURL(d.image, true)) {
        if (!img) {
          img = el("img", "sl-cms-image");
          img.alt = "";
          img.loading = "lazy";
          card.prepend(img);
        }
        img.src = safeURL(d.image, true);
      } else img?.remove();
    }
    // Only reorder siblings of the same kind; preserve scripts, headings and functional sections.
    const parents = new Set(
      [...document.querySelectorAll("[data-cms-id]")].map(
        (n) => n.parentElement,
      ),
    );
    for (const parent of parents) {
      const children = [...parent.children].filter((n) => n.dataset.cmsId);
      if (!children.some((n) => n.dataset.cmsOrder)) continue;
      const order = children
        .map((n, i) => ({
          n,
          order: Number(n.dataset.cmsOrder ?? (i + 1) * 10),
        }))
        .sort((a, b) => a.order - b.order);
      const marker = document.createComment("managed order");
      parent.insertBefore(marker, children[0]);
      for (const x of order) parent.insertBefore(x.n, marker);
      marker.remove();
    }
    // The More anchor is a boundary AFTER the final visible built-in panel.
    // Do not force it after Free Lesson Packs: admins may order Other A/L
    // Resources after the lessons, and the rail must reflect actual layout.
    if (page === "index.html") {
      const more = document.getElementById("more-learning-resources");
      const main = more?.parentElement;
      const builtins = main && [...main.children].filter((node) =>
        node.matches("section.sl-home-section[data-cms-id]") && !node.hidden);
      if (builtins?.length) builtins[builtins.length - 1].after(more);
    }
  }
  async function readPublished() {
    // Public published content does not require a signed-in account or the
    // optional Supabase JavaScript SDK. This works on the resource subpages
    // even if their CDN-loaded authentication library failed to initialize.
    const endpoint = "https://zpvatyxdbshjuqgtexzw.supabase.co";
    const publicKey = "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB";
    let directError;
    try {
      const query = endpoint + "/rest/v1/studylab_site_content?select=payload&page=eq." +
        encodeURIComponent(page) + "&limit=1000";
      const response = await fetch(query, {
        headers: { apikey: publicKey, Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw Error("Published content HTTP " + response.status);
      const entries = await response.json();
      if (!Array.isArray(entries)) throw Error("Invalid content response");
      return entries.map(entry => entry?.payload).filter(Boolean);
    } catch (error) {
      directError = error;
    }
    // For unusual browser/network environments, retain the existing SDK path
    // as a fallback. Never require the user to be an administrator to read.
    const client = window.StudyLabAccount?.client ||
      window.supabase?.createClient?.(endpoint, publicKey);
    if (!client) throw directError;
    const result = await client.from("studylab_site_content")
      .select("payload").eq("page",page).limit(1000);
    if (result.error) throw result.error;
    return (result.data || []).map(entry => entry.payload).filter(Boolean);
  }

  function showContentLoadError() {
    if (document.querySelector("[data-cms-load-error]")) return;
    const host = document.querySelector(".tool-grid,.sl-lessons-publisher-grid," +
      ".telegram-all-grid,[data-cms-additions]");
    if (!host) return;
    const notice = el("div","sl-cms-load-error");
    notice.dataset.cmsLoadError = "true";
    const message = el("span",null,"Newest published resources couldn't be loaded.");
    const retry = el("button",null,"Retry");
    retry.type = "button";
    retry.addEventListener("click",()=>{
      notice.remove();
      void start();
    });
    notice.append(message,retry);
    host.before(notice);
  }

  let lastAttemptAt = 0;
  async function start() {
    lastAttemptAt = Date.now();
    let records;
    try {
      records = await readPublished();
      document.querySelector("[data-cms-load-error]")?.remove();
    } catch (error) {
      console.warn("StudyLab published content could not load:",error);
      showContentLoadError();
      return;
    }
    const client = window.StudyLabAccount?.client ||
      window.supabase?.createClient?.(
        "https://zpvatyxdbshjuqgtexzw.supabase.co",
        "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB"
      );
    const draftMode = new URLSearchParams(location.search).get("admin-preview")==="1";
    if (config.mode === "preview") {
      // Sandboxed admin edits are private local overlays. Visitors only see
      // the real public database, never another administrator's local drafts.
      let state=null;
      try {
        state=JSON.parse(localStorage.getItem("studylab-admin-preview-v1")||"null");
      }catch(_){ /* Ignore invalid local preview JSON. */ }
      if (client && (state || draftMode)) {
        const account=window.StudyLabAccount;
        await account?.startup;
        const auth=await client.auth.getUser();
        if(auth.data?.user && !auth.data.user.is_anonymous){
          const allowed=await client.rpc("studylab_social_is_admin");
          if(!allowed.error && allowed.data===true){
            if(state?.owner===auth.data.user.id){
              for(const item of state.published||[]){
                if(item.page!==page)continue;
                records=records.filter(x=>x.id!==item.id);
                records.push(item);
              }
            }
            if(draftMode){
              let draft=null;
              try{
                draft=JSON.parse(localStorage.getItem("studylab-admin-draft-preview")||"null");
              }catch(_){ /* Ignore damaged preview drafts. */ }
              if(draft?.owner===auth.data.user.id && draft.item?.page===page){
                records=records.filter(x=>x.id!==draft.item.id);
                records.push(draft.item);
                document.body.prepend(el("div","sl-cms-preview-banner",
                  "Admin draft preview · Only visible on this device"));
              }
            }
          }
        }
      }
    }else if(draftMode && client){
      // Connected PR #102 also supports a private draft overlay. Only a
      // verified admin on the same browser/account can see it.
      const account=window.StudyLabAccount;
      await account?.startup;
      const auth=await client.auth.getUser();
      if(auth.data?.user && !auth.data.user.is_anonymous){
        const allowed=await client.rpc("studylab_social_is_admin");
        if(!allowed.error && allowed.data===true){
          let draft=null;
          try{
            draft=JSON.parse(localStorage.getItem("studylab-admin-draft-preview")||"null");
          }catch(_){ /* Ignore invalid private preview records. */ }
          if(draft?.owner===auth.data.user.id && draft.item?.page===page){
            records=records.filter(x=>x.id!==draft.item.id);
            records.push(draft.item);
            document.body.prepend(el("div","sl-cms-preview-banner",
              "Private admin draft preview · Not published"));
          }
        }
      }
    }
    apply(records);
    window.dispatchEvent(new CustomEvent("studylab-content-applied",{
      detail:{page,records:records.length}
    }));
  }
  function refreshPublished() {
    void start().catch((error)=>
      console.warn("StudyLab content refresh failed:",error));
  }
  refreshPublished();
  // Returning from admin or browser back-forward cache should show new
  // published cards without a hard reload. Avoid excessive focus refetches.
  window.addEventListener("pageshow",event=>{
    if(event.persisted)refreshPublished();
  });
  window.addEventListener("focus",()=>{
    if(Date.now()-lastAttemptAt>5000)refreshPublished();
  });
})();
