/* StudyLab one-time notices: selected server-side expiry and atomic per-account claims. */
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
      const requested = Number(item.display_seconds);
      const persistent = requested === 0;
      const seconds = persistent ? 0 : Math.max(3,Math.min(60,Number.isFinite(requested) ? requested : 8));
      box.style.setProperty("--slpopup-seconds",seconds+"s");
      if (persistent) box.dataset.persistent = "true";
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
      // display_seconds=0 means the visitor dismisses it with ×.
      // Do not arm any countdown or hidden fallback for persistent messages.
      if (!persistent) {
        stopTimer = window.StudyLabPopupFormat?.armTimer
          ? window.StudyLabPopupFormat.armTimer(box,seconds*1000,finish)
          : (() => { const id = setTimeout(finish,seconds*1000); return () => clearTimeout(id); })();
      }
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
    // The StudyLab welcome, sign-in and signup screens use the Home URL.
    // Not a single receipt may be claimed until Home was actually entered.
    const path = location.pathname.replace(/\\/+$/, "").toLowerCase();
    if (!(path === "" || path === "/" || path.endsWith("/index.html"))) return;
    if (!(await waitForHomeEntry())) return;
    const account = window.StudyLabAccount;
    if (!account) return;
    const enteredOnStartup = await account.startup;
    const gateway = document.getElementById("studylab-auth-gateway");
    if (!enteredOnStartup || (gateway && !gateway.hidden)) {
      await new Promise(resolve => {
        const entered = () => {
          window.removeEventListener("studylab-home-entered",entered);
          resolve();
        };
        window.addEventListener("studylab-home-entered",entered);
        // A guest or Google flow may finish before the listener is attached.
        if (gateway?.hidden && account.getUser?.()?.id) entered();
      });
    }
    if (!account.getUser?.()?.id) return;
    await account.ready;
    await window.StudyLabBanGuardReady;
    if (window.StudyLabBanned || !homeIsVisible()) return;
    const client = account.client || window.supabase?.createClient?.(PROJECT,KEY);
    if (!client) return;

    let working = false, pending = false, closed = false;
    async function loadEligible() {
      if (closed || !homeIsVisible() || window.StudyLabBanned) return;
      if (working) { pending = true; return; }
      working = true;
      try {
        // Re-check auth because Home may remain open through a logout.
        const auth = await client.auth.getUser();
        const uid = auth?.data?.user?.id;
        if (!uid || auth.error) return;
        let resp = await client.from("studylab_popups")
          .select("id,title,message,variant,placement,display_seconds,link,link_label,starts_at,expires_at")
          .order("starts_at",{ascending:false}).limit(12);
        if (resp.error) {
          console.warn("StudyLab pop-up retrieval failed:",resp.error.message);
          return;
        }
        for (const item of resp.data || []) {
          if (closed || !homeIsVisible() || window.StudyLabBanned) return;
          const startAt = new Date(item.starts_at).getTime();
          const stopAt = new Date(item.expires_at).getTime();
          if (!Number.isFinite(startAt) || !Number.isFinite(stopAt) ||
              Date.now() < startAt || Date.now() >= stopAt) continue;
          const key = localPrefix + item.id + ":" + uid;
          if (localSeen(key)) continue;
          const claim = await client.rpc("studylab_popup_claim",{p_id:item.id});
          if (claim.error) {
            console.warn("StudyLab pop-up claim failed:",claim.error.message);
            continue;
          }
          if (claim.data !== true) continue;
          if (closed || !homeIsVisible()) return;
          markLocal(key);
          await showOne(item);
        }
      } catch (error) {
        console.warn("StudyLab pop-up delivery failed:",error?.message || error);
      } finally {
        working = false;
        if (pending && !closed) {
          pending = false;
          setTimeout(loadEligible,0);
        }
      }
    }

    function refresh() {
      if (!closed && !document.hidden && homeIsVisible()) void loadEligible();
    }
    // New admin messages become visible to students ALREADY on Home. This
    // publication emits only occasional popup create/edit events, not heartbeats.
    let channel = null;
    if (typeof client.channel === "function") {
      try {
        channel = client.channel("studylab-home-popup-notices")
          .on("postgres_changes",{event:"*",schema:"public",table:"studylab_popups"},refresh)
          .subscribe(status => { if (status === "SUBSCRIBED") refresh(); });
      } catch (error) {
        console.warn("StudyLab popup Realtime unavailable; focus refresh remains active:",error);
      }
    }
    // Safety net for network interruptions or future-dated announcements:
    // query at most once per five minutes while Home is visible.
    const fallbackTimer = setInterval(refresh,300000);
    window.addEventListener("online",refresh);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    window.addEventListener("pagehide",() => {
      closed = true;
      clearInterval(fallbackTimer);
      window.removeEventListener("online",refresh);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",refresh);
      if (channel && typeof client.removeChannel === "function")
        client.removeChannel(channel).catch?.(() => {});
    },{once:true});
    await loadEligible();
  }
  start().catch((e) => console.warn("StudyLab messages unavailable:",e?.message));
})();
