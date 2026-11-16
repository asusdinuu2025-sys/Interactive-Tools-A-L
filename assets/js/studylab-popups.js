/* StudyLab one-time notices: 24h server expiry and atomic per-account claims. */
(function () {
  "use strict";
  if (window.StudyLabPopupsLoaded) return;
  window.StudyLabPopupsLoaded = true;
  const PROJECT = "https://zpvatyxdbshjuqgtexzw.supabase.co";
  const KEY = "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB";
  const localPrefix = "studylab-popup-seen-v1:";
  function localSeen(key) {
    try { return localStorage.getItem(key) === "1"; } catch (_) { return false; }
  }
  function markLocal(key) {
    try { localStorage.setItem(key, "1"); } catch (_) { /* private mode */ }
  }
  function safeLink(raw) {
    if (!raw || typeof raw !== "string" || raw.startsWith("//")) return null;
    try {
      const url = new URL(raw, location.href);
      if (url.protocol !== "https:" && url.origin !== location.origin) return null;
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
        return null;
      return url.href;
    } catch (_) { return null; }
  }
  function showOne(item) {
    return new Promise((resolve) => {
      const box = document.createElement("aside");
      box.className = "slpopup-toast slpopup-" + item.variant;
      box.dataset.placement = item.placement || "top-right";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      const seconds = Math.max(3,Math.min(30,Number(item.display_seconds) || 8));
      box.style.setProperty("--slpopup-seconds",seconds+"s");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "slpopup-close";
      close.textContent = "×";
      close.setAttribute("aria-label", "Dismiss StudyLab message");
      const title = document.createElement("strong");
      title.textContent = item.title || "StudyLab update";
      const message = document.createElement("p");
      message.className = "slpopup-message";
      if (window.StudyLabPopupFormat?.render)
        window.StudyLabPopupFormat.render(message, item.message || "");
      else message.textContent = item.message || "";
      box.append(close,title,message);
      const href = safeLink(item.link);
      if (href) {
        const link = document.createElement("a");
        link.className = "slpopup-link";
        link.href = href;
        if (new URL(href).origin !== location.origin) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        const label = String(item.link_label || "View").trim();
        link.textContent = label && label.length <= 20 ? label : "View";
        box.append(link);
      }
      let finished = false, stopTimer = () => {};
      const finish = () => {
        if (finished) return;
        finished = true;
        stopTimer();
        box.remove();
        resolve();
      };
      close.addEventListener("click",finish);
      document.body.append(box);
      stopTimer = window.StudyLabPopupFormat?.armTimer
        ? window.StudyLabPopupFormat.armTimer(box,seconds*1000,finish)
        : (() => { const id = setTimeout(finish,seconds*1000); return () => clearTimeout(id); })();
    });
  }
  function homeIsVisible() {
    const gateway = document.getElementById("studylab-auth-gateway");
    // The welcome, signup and login views share /index.html with Home.
    // A pathname-only check is therefore insufficient.
    return !gateway || gateway.hidden === true;
  }
  async function waitForHomeEntry() {
    // Auth gateway is initialized before this script. Waiting for startup
    // prevents its initial hidden state being mistaken for an entered Home.
    try { await window.StudyLabAccount?.startup; } catch (_) {}
    if (!homeIsVisible()) {
      const gateway = document.getElementById("studylab-auth-gateway");
      await new Promise(resolve => {
        const observer = new MutationObserver(() => {
          if (gateway.hidden || !gateway.isConnected) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(gateway,{attributes:true,attributeFilter:["hidden"]});
      });
    }
    return homeIsVisible();
  }
  async function start() {
    // Only deliver after the welcome/sign-in flow has entered the actual
    // homepage. Never claim a one-time message from a signup or subpage.
    const path = location.pathname.replace(/\/+$/, "").toLowerCase();
    if (!(path === "" || path === "/" || path.endsWith("/index.html"))) return;
    if (!(await waitForHomeEntry())) return;
    // The homepage URL also hosts the welcome/sign-in overlay. Do not
    // read/claim a one-time notice until that overlay has truly closed.
    // Await the account startup decision first to avoid a startup race.
    const account = window.StudyLabAccount;
    if (!account) return;
    const alreadyEntered = await account.startup;
    const gateway = document.getElementById("studylab-auth-gateway");
    if (!alreadyEntered || (gateway && !gateway.hidden)) {
      await new Promise(resolve => {
        const entered = () => {
          window.removeEventListener("studylab-home-entered", entered);
          resolve();
        };
        window.addEventListener("studylab-home-entered", entered);
        // A session may have completed while the handler was installed.
        if (gateway?.hidden && account.getUser?.()?.id) entered();
      });
    }
    // A newly created guest may be active only after the explicit entry event.
    if (!account.getUser?.()?.id) return;
    await account.ready;
    await window.StudyLabBanGuardReady;
    if (window.StudyLabBanned || !homeIsVisible()) return;
    const client = window.StudyLabAccount?.client ||
      window.supabase?.createClient?.(PROJECT,KEY);
    if (!client) return;
    // Supabase RLS allows only messages within their exact 24-hour window.
    // Recheck the account before reading or claiming delivery. A pre-login
    // visitor must not consume a once-only notification.
    const auth = await client.auth.getUser();
    if (!auth.data?.user?.id || auth.error) return;
    const resp = await client.from("studylab_popups")
      .select("id,title,message,variant,placement,display_seconds,link,link_label,starts_at")
      .order("starts_at",{ascending:false}).limit(8);
    if (resp.error || !resp.data?.length) return;
    let account = null;
    try { account = (await client.auth.getUser()).data?.user || null; }
    catch (_) { account = null; }
    for (const item of resp.data) {
      // If the account chooser opens again, don't consume a delivery receipt.
      if (!(await waitForHomeEntry())) return;
      const startAt = new Date(item.starts_at).getTime();
      if (!Number.isFinite(startAt) ||
          Date.now()<startAt || Date.now()>=startAt+86400000) continue;
      const key = localPrefix + item.id + ":" + (account?.id || "browser");
      if (localSeen(key)) continue;
      if (account?.id) {
        // One-time delivery survives devices, sessions and page refreshes.
        const claim = await client.rpc("studylab_popup_claim",{p_id:item.id});
        if (claim.error || claim.data !== true) continue;
      }
      if (!homeIsVisible()) return;
      markLocal(key);
      await showOne(item);
    }
  }
  start().catch((e) => console.warn("StudyLab messages unavailable:",e?.message));
})();
