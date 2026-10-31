/* StudyLab PWA installation and privacy-conscious installation analytics. */
(function () {
  "use strict";

  const button = document.getElementById("installStudyLabButton");
  const dialog = document.getElementById("pwaInstallHelp");
  const dialogText = document.getElementById("pwaInstallHelpText");
  const dialogSteps = document.getElementById("pwaInstallHelpSteps");
  const closeButton = document.getElementById("pwaInstallHelpClose");
  if (!button) return;

  const INSTALL_ID_KEY = "studylabPwaInstallationIdV1";
  const INSTALLED_AT_KEY = "studylabPwaInstalledAtV1";
  let deferredPrompt = null;
  let lastRecordPromise = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      navigator.standalone === true ||
      document.referrer.startsWith("android-app://");
  }

  function createUuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
      hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function getInstallationIdentity() {
    let installationId = "";
    let installedAt = "";
    try {
      installationId = localStorage.getItem(INSTALL_ID_KEY) || "";
      if (!/^[0-9a-f-]{36}$/i.test(installationId)) {
        installationId = createUuid();
        localStorage.setItem(INSTALL_ID_KEY, installationId);
      }
      installedAt = localStorage.getItem(INSTALLED_AT_KEY) || "";
      if (!installedAt || Number.isNaN(Date.parse(installedAt))) {
        installedAt = new Date().toISOString();
        localStorage.setItem(INSTALLED_AT_KEY, installedAt);
      }
    } catch (_) {
      installationId = createUuid();
      installedAt = new Date().toISOString();
    }
    return { installationId, installedAt };
  }

  function getPlatform() {
    const value = String(navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
    if (value.includes("win")) return "Windows";
    if (value.includes("android")) return "Android";
    if (/iphone|ipad|ipod/.test(value)) return "iOS";
    if (value.includes("mac")) return "macOS";
    if (value.includes("linux")) return "Linux";
    return "Other";
  }

  function getBrowser() {
    const ua = navigator.userAgent || "";
    if (/Edg\//.test(ua)) return "Edge";
    if (/OPR\//.test(ua)) return "Opera";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/CriOS\//.test(ua) || /Chrome\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua)) return "Safari";
    return "Other";
  }

  async function recordInstallation() {
    if (lastRecordPromise) return lastRecordPromise;
    lastRecordPromise = (async function () {
      const account = window.StudyLabAccount;
      if (!account?.ready || !account?.client) return;
      await account.ready;
      const user = account.getUser?.();
      if (!user?.id) return;

      const identity = getInstallationIdentity();
      const now = new Date().toISOString();
      const { error } = await account.client
        .from("studylab_pwa_installations")
        .upsert({
          user_id: user.id,
          installation_id: identity.installationId,
          platform: getPlatform(),
          browser: getBrowser(),
          installed_at: identity.installedAt,
          last_opened_at: now,
          updated_at: now
        }, { onConflict: "user_id,installation_id" });

      if (error) throw error;
    })().catch(error => {
      console.warn("StudyLab PWA installation analytics:", error);
    }).finally(() => {
      lastRecordPromise = null;
    });
    return lastRecordPromise;
  }

  function hideInstallButton() {
    button.hidden = true;
    button.setAttribute("aria-hidden", "true");
  }

  function showInstallHelp() {
    const platform = getPlatform();
    const browser = getBrowser();
    let intro = "Install StudyLab from your browser menu. The installed app stays online and receives updates from the StudyLab website.";
    let steps = [];

    if (platform === "iOS") {
      intro = "On iPhone or iPad, add StudyLab to your Home Screen using Safari.";
      steps = ["Open this page in Safari.", "Tap the Share button.", "Choose “Add to Home Screen”.", "Tap Add. StudyLab will appear on your Home Screen."];
    } else if (platform === "macOS" && browser === "Safari") {
      intro = "Safari can add StudyLab to your Mac Dock as a web app.";
      steps = ["Open StudyLab in Safari.", "Choose File in the menu bar.", "Select “Add to Dock”.", "Confirm the app name and choose Add."];
    } else if (browser === "Edge") {
      steps = ["Open the Edge menu (⋯).", "Choose Apps, then “Install this site as an app”.", "Confirm Install."];
    } else if (browser === "Chrome") {
      steps = ["Open the Chrome menu (⋮).", "Choose “Install StudyLab” or “Cast, save, and share” → “Install page as app”.", "Confirm Install."];
    } else if (browser === "Safari") {
      steps = ["Open StudyLab in Safari.", "Choose File → “Add to Dock” if available.", "Confirm the installation."];
    } else {
      intro = "This browser may not support installing websites as desktop apps. Open StudyLab in the latest Chrome or Microsoft Edge to install it.";
      steps = ["Copy the StudyLab website address.", "Open it in Chrome or Microsoft Edge.", "Use the browser’s Install option in the address bar or menu."];
    }

    if (dialog && typeof dialog.showModal === "function") {
      dialogText.textContent = intro;
      dialogSteps.replaceChildren();
      steps.forEach(step => {
        const item = document.createElement("li");
        item.textContent = step;
        dialogSteps.appendChild(item);
      });
      dialog.showModal();
    } else {
      window.alert(intro + "\n\n" + steps.map((step, index) => (index + 1) + ". " + step).join("\n"));
    }
  }

  button.addEventListener("click", async function () {
    if (!deferredPrompt) {
      showInstallHelp();
      return;
    }
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === "accepted") {
        getInstallationIdentity();
        await recordInstallation();
        button.textContent = "Installing…";
        button.disabled = true;
      }
    } catch (error) {
      console.warn("StudyLab PWA install prompt:", error);
      showInstallHelp();
    }
  });

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    button.dataset.nativePrompt = "available";
  });

  window.addEventListener("appinstalled", function () {
    getInstallationIdentity();
    recordInstallation();
    hideInstallButton();
  });

  if (isStandalone()) {
    hideInstallButton();
    getInstallationIdentity();
    recordInstallation();
  }

  if (closeButton && dialog) {
    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/service-worker.js?v=1.0.0", {
        scope: "/",
        updateViaCache: "none"
      }).catch(error => {
        console.warn("StudyLab PWA service worker registration:", error);
      });
    }, { once: true });
  }
})();
