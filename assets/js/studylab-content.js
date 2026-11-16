/* Published overrides enhance existing markup; failures leave original content intact. */
(function () {
  "use strict";
  const config = window.StudyLabAdminConfig || { mode: "preview" },
    page = location.pathname.split("/").pop() || "index.html";
  function safeURL(raw, image = false) {
    try {
      raw = String(raw || "")
        .trim()
        .replace(/ /g, "%20");
      if (!raw) return null;
      if (
        config.mode === "preview" &&
        /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[a-z0-9+/=]+$/i.test(
          raw,
        )
      )
        return raw;
      if (/[\u0000-\u0020\u007f\\]/.test(raw) || raw.startsWith("//"))
        return null;
      const u = new URL(raw, location.href);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
        return null;
      if (u.origin !== location.origin && u.protocol !== "https:") return null;
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
      const href = safeURL(d.url);
      if (!href) continue;
      if (!card) {
        card = el("a", "sl-cms-card");
        card.dataset.cmsId = d.id;
        card.append(el("h3"), el("p"), el("span", "sl-cms-open", "Open resource →"));
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
  }
  async function start() {
    let records = [];
    if (config.mode === "preview") {
      // Preview data is local and read only after admin verification; visitors get unchanged content.
      const state = JSON.parse(
        localStorage.getItem("studylab-admin-preview-v1") || "null",
      );
      const draftMode =
        new URLSearchParams(location.search).get("admin-preview") === "1";
      if (!state && !draftMode) return;
      const account = window.StudyLabAccount;
      await account?.startup;
      const client =
        account?.client ||
        window.supabase?.createClient(
          "https://zpvatyxdbshjuqgtexzw.supabase.co",
          "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB",
        );
      if (!client) return;
      const u = await client.auth.getUser();
      if (!u.data?.user || u.data.user.is_anonymous) return;
      const admin = await client.rpc("studylab_social_is_admin");
      if (admin.error || admin.data !== true) return;
      if (state?.owner === u.data.user.id) records = state.published || [];
      if (draftMode) {
        const draft = JSON.parse(
          localStorage.getItem("studylab-admin-draft-preview") || "null",
        );
        if (draft?.owner === u.data.user.id && draft.item)
          records = [
            ...records.filter((x) => x.id !== draft.item.id),
            draft.item,
          ];
        const banner = el(
          "div",
          "sl-cms-preview-banner",
          "Admin draft preview · Only visible on this device",
        );
        document.body.prepend(banner);
      }
    } else {
      const client =
        window.StudyLabAccount?.client ||
        window.supabase?.createClient(
          "https://zpvatyxdbshjuqgtexzw.supabase.co",
          "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB",
        );
      if (!client) return;
      const r = await client
        .from("studylab_site_content")
        .select("payload")
        .eq("page", page)
        .limit(1000);
      if (r.error) return;
      records = (r.data || []).map((x) => x.payload);
      // Connected PR #102 and production must preserve the existing
      // Draft Preview workflow. Never show a private draft to a visitor.
      if (new URLSearchParams(location.search).get("admin-preview") === "1") {
        const account = window.StudyLabAccount;
        await account?.startup;
        const auth = await client.auth.getUser();
        if (auth.data?.user && !auth.data.user.is_anonymous) {
          const allowed = await client.rpc("studylab_social_is_admin");
          if (!allowed.error && allowed.data === true) {
            let draft = null;
            try {
              draft = JSON.parse(localStorage.getItem("studylab-admin-draft-preview") || "null");
            } catch (_) { /* A damaged local draft must not hide public content. */ }
            if (draft?.owner === auth.data.user.id && draft.item?.page === page) {
              records = [
                ...records.filter((x) => x.id !== draft.item.id),
                draft.item,
              ];
              document.body.prepend(el(
                "div", "sl-cms-preview-banner",
                "Private admin draft preview · Not published"
              ));
            }
          }
        }
      }
    }
    apply(records);
  }
  start().catch((e) =>
    console.warn("StudyLab content kept its existing version:", e.message),
  );
})();
