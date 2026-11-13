/*
 * StudyLab student profile completion and editor.
 * Submitted fields are stored on the student's own Supabase row.
 */
(function () {
  "use strict";
  const profileButton = document.getElementById("profileButton");
  const profileModal = document.getElementById("profileModal");
  const profileForm = document.getElementById("profileForm");
  const profileInput = document.getElementById("profileName");
  const profileNameStatus = document.getElementById("profileNameStatus");
  const profileUsername = document.getElementById("profileUsername");
  const profileUsernameStatus = document.getElementById("profileUsernameStatus");
  const profileSchool = document.getElementById("profileSchool");
  const profilePhone = document.getElementById("profilePhone");
  const profileExamYear = document.getElementById("profileExamYear");
  const profileStream = document.getElementById("profileStream");
  const genderButtons = [...document.querySelectorAll("[data-profile-gender]")];
  let selectedGender = "";
  const profileStatus = document.getElementById("profileStatus");
  const profileNameLabel = document.getElementById("profileNameLabel");
  const profileSubtitle = document.getElementById("profileSubtitle");
  const profileFields = [profileInput, profileUsername, profileSchool, profilePhone, profileExamYear, profileStream];
  let closeTimer = null;
  let nameCheckTimer = null;
  let nameCheckSequence = 0;
  let savedDisplayName = "";
  let usernameCheckTimer = null;
  let usernameCheckSequence = 0;
  let savedUsername = "";
  let mandatoryProfile = false;
  let requireFullProfile = false;
  let onboardingAuthIntent = "";

  const profileClose = document.getElementById("profileClose");

  if (!profileButton || !profileModal || !profileForm || !profileInput) return;
  const profileDialog = profileModal.querySelector(".profile-dialog");

  // Keep profile editing and authentication in one clear account menu.
  const accountWrap = document.createElement("div");
  accountWrap.className = "profile-account-wrap";
  profileButton.parentNode.insertBefore(accountWrap, profileButton);
  accountWrap.appendChild(profileButton);
  const accountMenu = document.createElement("div");
  accountMenu.className = "profile-account-menu";
  accountMenu.id = "profileAccountMenu";
  accountMenu.hidden = true;
  accountMenu.setAttribute("role", "menu");
  document.body.appendChild(accountMenu);

  const accountMenuStyle = document.createElement("style");
  accountMenuStyle.textContent = `
    .profile-account-wrap { position:relative;display:inline-flex;align-items:center; }
    .profile-button { gap:9px; }
    .profile-button .profile-menu-caret { display:inline-grid;place-items:center;margin-left:2px;opacity:.76; }
    .profile-button .profile-menu-caret svg { display:block;width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round; }
    .profile-account-menu {
      position:fixed !important;z-index:2147483000 !important;top:0;left:0;
      width:min(340px,calc(100vw - 24px));max-width:calc(100vw - 24px);
      max-height:min(72vh,460px);overflow-y:auto;overscroll-behavior:contain;
      padding:11px;border:1px solid rgba(150,190,230,.24);border-radius:20px;
      background:rgba(13,24,40,.97);color:#eaf3ff;
      box-shadow:0 24px 72px rgba(0,0,0,.46),0 4px 18px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.1);
      backdrop-filter:blur(26px) saturate(150%);-webkit-backdrop-filter:blur(26px) saturate(150%);
      transform-origin:top right;animation:profileMenuIn .16s ease-out;
      font-family:"Nirmala UI","Segoe UI",sans-serif !important;font-size:14px;
      isolation:isolate;
    }
    .profile-account-menu[hidden] { display:none; }
    .profile-account-menu, .profile-account-menu * { font-family:"Nirmala UI","Segoe UI",sans-serif !important; }
    .profile-account-menu .account-menu-heading { padding:10px 12px 9px;color:#a9bfd8;font-size:12px;font-weight:800;letter-spacing:.11em; }
    .profile-account-menu button {
      display:flex;width:100%;min-height:54px;align-items:center;gap:13px;padding:12px;border:0;border-radius:13px;
      background:transparent;color:inherit;text-align:left;cursor:pointer;font-size:14px;transition:background .16s ease;
    }
    .profile-account-menu button:hover,.profile-account-menu button:focus-visible { background:rgba(125,190,255,.14);outline:2px solid rgba(125,190,255,.28);outline-offset:-2px; }
    .profile-account-menu .account-menu-icon { display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border:1px solid rgba(125,190,255,.22);border-radius:12px;background:rgba(90,160,230,.12);color:#a9dfff;font-size:19px; }
    .profile-account-menu .account-menu-copy { display:grid;gap:4px;min-width:0; }
    .profile-account-menu .account-menu-copy strong { font-size:15px;font-weight:700;line-height:1.25; }
    .profile-account-menu .account-menu-copy small { color:#b3c3d8;font-size:12.5px;line-height:1.4; }
    .profile-account-menu .account-menu-divider { height:1px;margin:7px 8px;background:rgba(160,190,220,.17); }
    .profile-account-menu .account-menu-status { margin:7px 10px 8px;color:#ff9b9b;font-size:12px;line-height:1.5; }
    html[data-theme="light"] .profile-account-menu {
      background:rgba(255,255,255,.985);color:#20344c;border-color:rgba(80,130,175,.24);
      box-shadow:0 24px 65px rgba(35,70,105,.25),0 4px 16px rgba(35,70,105,.12),inset 0 1px #fff;
    }
    html[data-theme="light"] .profile-account-menu .account-menu-heading,
    html[data-theme="light"] .profile-account-menu .account-menu-copy small { color:#536b85; }
    html[data-theme="light"] .profile-account-menu button:hover,
    html[data-theme="light"] .profile-account-menu button:focus-visible { background:rgba(70,145,220,.11);outline-color:rgba(70,145,220,.24); }
    html[data-theme="light"] .profile-account-menu .account-menu-icon { color:#286b9e;background:rgba(70,145,220,.09);border-color:rgba(70,145,220,.2); }
    @keyframes profileMenuIn { from { opacity:0;transform:translateY(-5px) scale(.985); } to { opacity:1;transform:none; } }
    @media(max-width:600px) {
      .profile-account-menu { width:min(320px,calc(100vw - 20px));max-height:min(70vh,440px); }
      .profile-account-menu button { min-height:56px;padding:13px 12px; }
    }
    @media(prefers-reduced-motion:reduce) { .profile-account-menu { animation:none; } }
  `;
  document.head.appendChild(accountMenuStyle);

  function positionAccountMenu() {
    if (accountMenu.hidden) return;
    const rect = profileButton.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(340, window.innerWidth - margin * 2);
    accountMenu.style.width = width + "px";
    const menuHeight = accountMenu.getBoundingClientRect().height;
    let left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
    let top = rect.bottom + 10;
    if (top + menuHeight > window.innerHeight - margin && rect.top - menuHeight - 10 >= margin) {
      top = rect.top - menuHeight - 10;
      accountMenu.style.transformOrigin = "bottom right";
    } else {
      accountMenu.style.transformOrigin = "top right";
    }
    accountMenu.style.left = left + "px";
    accountMenu.style.top = Math.max(margin, Math.min(top, window.innerHeight - menuHeight - margin)) + "px";
  }
  function closeAccountMenu() {
    accountMenu.hidden = true;
    profileButton.setAttribute("aria-expanded", "false");
  }
  function renderAccountMenu() {
    const isGuest = Boolean(window.StudyLabAccount?.getUser?.()?.is_anonymous);
    accountMenu.innerHTML = isGuest ? `
      <div class="account-menu-heading">GUEST SESSION</div>
      <button type="button" role="menuitem" data-account-action="profile">
        <span class="account-menu-icon" aria-hidden="true">♙</span>
        <span class="account-menu-copy"><strong>Edit profile</strong><small>Update your student details</small></span>
      </button>
      <div class="account-menu-divider"></div>
      <button type="button" role="menuitem" data-account-action="signup">
        <span class="account-menu-icon" aria-hidden="true">＋</span>
        <span class="account-menu-copy"><strong>Create StudyLab account</strong><small>Connect Google and keep this Guest session</small></span>
      </button>
      <button type="button" role="menuitem" data-account-action="login">
        <span class="account-menu-icon" aria-hidden="true">↗</span>
        <span class="account-menu-copy"><strong>Sign in to existing account</strong><small>Continue with your registered Google account</small></span>
      </button>
      <p class="account-menu-status" role="status" hidden></p>` : `
      <div class="account-menu-heading">YOUR STUDYLAB ACCOUNT</div>
      <button type="button" role="menuitem" data-account-action="profile">
        <span class="account-menu-icon" aria-hidden="true">♙</span>
        <span class="account-menu-copy"><strong>Edit student profile</strong><small>Update your StudyLab profile details</small></span>
      </button>
      <div class="account-menu-divider"></div>
      <button type="button" role="menuitem" data-account-action="signout">
        <span class="account-menu-icon" aria-hidden="true">⇥</span>
        <span class="account-menu-copy"><strong>Sign out</strong><small>Sign out of this StudyLab account</small></span>
      </button>
      <p class="account-menu-status" role="status" hidden></p>`;
  }
  function toggleAccountMenu() {
    if (!accountMenu.hidden) { closeAccountMenu(); return; }
    renderAccountMenu();
    accountMenu.hidden = false;
    profileButton.setAttribute("aria-expanded", "true");
    positionAccountMenu();
    requestAnimationFrame(positionAccountMenu);
  }
  accountMenu.addEventListener("click", async event => {
    const action = event.target.closest("[data-account-action]")?.dataset.accountAction;
    if (!action) return;
    if (action === "profile") { closeAccountMenu(); openModal(); return; }
    if (action === "signup" || action === "login") {
      closeAccountMenu();
      window.StudyLabAuthGateway?.open(action);
      return;
    }
    if (action === "signout") {
      const status = accountMenu.querySelector(".account-menu-status");
      const button = accountMenu.querySelector('[data-account-action="signout"]');
      if (button) button.disabled = true;
      if (status) { status.hidden = false; status.textContent = "Signing out…"; }
      try {
        await window.StudyLabAccount.signOut();
        window.location.reload();
      } catch (error) {
        console.warn("StudyLab sign out:", error);
        if (status) status.textContent = "Could not sign out. Please try again.";
        if (button) button.disabled = false;
      }
    }
  });
  profileButton.setAttribute("aria-haspopup", "menu");
  profileButton.setAttribute("aria-controls", "profileAccountMenu");
  profileButton.setAttribute("aria-expanded", "false");
  document.addEventListener("click", event => {
    if (!accountWrap.contains(event.target) && !accountMenu.contains(event.target)) closeAccountMenu();
  });
  window.addEventListener("resize", positionAccountMenu, { passive: true });
  window.addEventListener("scroll", positionAccountMenu, { passive: true, capture: true });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !accountMenu.hidden) { closeAccountMenu(); profileButton.focus(); }
  });

  let homeGreetingName = "Student";
  function updateHomeGreeting(profile) {
    const greeting = document.getElementById("homeGreeting");
    if (!greeting) return;
    const isGuest = Boolean(window.StudyLabAccount?.getUser?.()?.is_anonymous);
    if (profile || isGuest) {
      homeGreetingName = isGuest
        ? "Guest"
        : (profile?.display_name && !placeholderName(profile.display_name)
          ? profile.display_name
          : (window.StudyLabAccount?.getGoogleName?.() || "Student"));
    }
    const hour = Number(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Colombo", hour: "2-digit", hourCycle: "h23"
    }).format(new Date()));
    const greetingTime = hour >= 5 && hour < 12 ? "Good morning"
      : hour >= 12 && hour < 17 ? "Good afternoon"
      : hour >= 17 && hour < 21 ? "Good evening" : "Good night";
    const timeLabel = document.getElementById("homeGreetingTime");
    const nameLabel = document.getElementById("homeGreetingName");
    if (timeLabel) timeLabel.textContent = greetingTime;
    if (nameLabel) nameLabel.textContent = homeGreetingName;
  }

  window.setInterval(() => updateHomeGreeting(), 60 * 1000);
  window.addEventListener("focus", () => updateHomeGreeting());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateHomeGreeting();
  });

  const placeholderName = name => /^Student\d{4}$/.test(String(name || ""));
  const isBasicComplete = p => Boolean(p?.display_name && !placeholderName(p.display_name) &&
    p?.exam_year && p?.study_stream);
  const isFullComplete = p => Boolean(p?.profile_completed_at && isBasicComplete(p) &&
    String(p.school || "").trim() && String(p.phone || "").trim() &&
    ["male", "female"].includes(p?.gender));
  const isComplete = isFullComplete;

  function updateRequiredFields() {
    profileSchool.required = mandatoryProfile;
    profilePhone.required = mandatoryProfile;
    const schoolLabel = document.querySelector('label[for="profileSchool"]');
    const phoneLabel = document.querySelector('label[for="profilePhone"]');
    const genderLegend = document.querySelector(".profile-gender-field legend");
    const phoneHint = document.getElementById("profilePhoneHint");
    if (schoolLabel) schoolLabel.innerHTML = mandatoryProfile ? 'School <span aria-hidden="true">*</span>' : 'School <span class="profile-optional">Optional</span>';
    if (phoneLabel) phoneLabel.innerHTML = mandatoryProfile ? 'Mobile number <span aria-hidden="true">*</span>' : 'Mobile number <span class="profile-optional">Optional</span>';
    if (genderLegend) genderLegend.innerHTML = mandatoryProfile ? 'Profile icon <span aria-hidden="true">*</span>' : 'Profile icon <span class="profile-optional">Optional</span>';
    if (phoneHint) phoneHint.textContent = mandatoryProfile
      ? "Required to enter the Study Room. Enter 9–12 digits, including country code if used."
      : "Optional. Required only to enter the Study Room.";
    if (profileClose) { profileClose.hidden = mandatoryProfile; profileClose.disabled = mandatoryProfile; }
  }

  function showStudyRoomGateToast() {
    const toastId = "studyRoomProfileGateToast";
    document.getElementById(toastId)?.remove();

    const styleId = "studyRoomProfileGateToastStyle";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        #studyRoomProfileGateToast {
          position: fixed;
          z-index: 1200;
          top: max(18px, env(safe-area-inset-top));
          left: 50%;
          transform: translate(-50%, -10px);
          width: max-content;
          max-width: min(92vw, 420px);
          padding: 12px 17px;
          border: 1px solid rgba(126, 220, 255, .32);
          border-radius: 14px;
          background: rgba(15, 28, 46, .96);
          color: #f3f8ff;
          box-shadow: 0 14px 38px rgba(0, 0, 0, .28);
          font: 600 14px/1.45 system-ui, sans-serif;
          text-align: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity .22s ease, transform .22s ease;
        }
        #studyRoomProfileGateToast.is-visible {
          opacity: 1;
          transform: translate(-50%, 0);
        }
        html[data-theme="light"] #studyRoomProfileGateToast {
          background: rgba(255, 255, 255, .98);
          color: #17243a;
          border-color: rgba(70, 110, 145, .24);
          box-shadow: 0 14px 38px rgba(35, 70, 105, .18);
        }
        @media (prefers-reduced-motion: reduce) {
          #studyRoomProfileGateToast { transition: none; }
        }
      `;
      document.head.appendChild(style);
    }

    const toast = document.createElement("div");
    toast.id = toastId;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = "To enter study room complete the profile.";
    document.body.appendChild(toast);
    window.requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 260);
    }, 3600);
  }

  const usernameFeedbackStyle = document.createElement("style");
  usernameFeedbackStyle.textContent = '.profile-username-status,.profile-name-status{margin-top:4px;font-weight:650}.profile-username-status[data-state="error"],.profile-name-status[data-state="error"]{color:#ff626f!important}.profile-username-status[data-state="success"],.profile-name-status[data-state="success"]{color:#35c98a!important}.profile-username-status[data-state="checking"],.profile-name-status[data-state="checking"]{color:var(--text-secondary)!important}';
  document.head.appendChild(usernameFeedbackStyle);

  const profileIconStyle = document.createElement("style");
  profileIconStyle.textContent = '.profile-button .header-action-icon{display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 20px;color:#9299a5!important} .profile-button .header-action-icon-female{color:#ff4fa3!important} .profile-button .header-action-icon-male{color:#39a8ff!important} .profile-button .header-action-icon-neutral{color:#9299a5!important} .profile-button .header-action-icon svg{width:20px;height:20px;fill:none;stroke:currentColor!important;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 2px currentColor) drop-shadow(0 0 4px currentColor)}';
  document.head.appendChild(profileIconStyle);
  function setButtonProfile(p) {
    const gender = p?.gender === "female" ? "female" : "male";
    const icon = gender === "female"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="7" r="3.2"/><path d="M7 20l1-4.2a4.1 4.1 0 0 1 8 0l1 4.2z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="7" r="3.2"/><path d="M4.5 20v-2.5a7.5 7.5 0 0 1 15 0V20z"/></svg>';
    const isGuest = Boolean(window.StudyLabAccount?.getUser?.()?.is_anonymous);
    const iconTone = isGuest ? "neutral" : gender;
    const profileGlyph = isGuest
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="7.2" r="3.2"/><path d="M4.5 20v-1.5a7.5 7.5 0 0 1 15 0V20z"/></svg>'
      : icon;
    profileButton.innerHTML = '<span class="header-action-icon header-action-icon-' + iconTone + '\" aria-hidden="true">' + profileGlyph + '</span><span class="profile-button-label"></span><span class="profile-menu-caret" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m6 9 6 6 6-6"/></svg></span>';
    const label = profileButton.querySelector(".profile-button-label");
    if (isGuest) {
      label.textContent = "Guest";
      profileButton.title = "Open Guest and account options";
      profileButton.setAttribute("aria-label", "Guest account options");
    } else if (isBasicComplete(p)) {
      label.textContent = p.display_name;
      profileButton.title = "Open your StudyLab account options";
      profileButton.setAttribute("aria-label", "Account options for " + p.display_name);
    } else if (p?.display_name && !placeholderName(p.display_name)) {
      label.textContent = "Complete Profile";
      profileButton.title = "Open account options and complete your student profile";
      profileButton.setAttribute("aria-label", "Complete your student profile");
    } else {
      label.textContent = "Account";
      profileButton.title = "Open your StudyLab account options";
      profileButton.setAttribute("aria-label", "Open StudyLab account options");
    }
    updateHomeGreeting(p);
    if (accountMenu && !accountMenu.hidden) renderAccountMenu();
  }
  function showStatus(message, isError = false) {
    profileStatus.textContent = message;
    profileStatus.hidden = false;
    profileStatus.dataset.state = isError ? "error" : "success";
  }
  async function getCloudProfile(force = false) {
    const account = window.StudyLabAccount;
    if (!account?.ready) throw new Error("StudyLab account is still starting.");
    await account.ready;
    return account.getProfile(force);
  }
  function fillForm(p) {
    const googleName = window.StudyLabAccount?.getSuggestedDisplayName?.() || "";
    profileInput.value = p?.display_name && !placeholderName(p.display_name) ? p.display_name : googleName;
    savedDisplayName = normalizeDisplayName(profileInput.value).toLowerCase();
    if (profileNameStatus) {
      profileNameStatus.hidden = true;
      profileNameStatus.textContent = "";
      profileNameStatus.dataset.state = "";
    }
    profileUsername.value = p?.username || "";
    savedUsername = String(p?.username || "").trim().toLowerCase();
    if (profileUsernameStatus) {
      profileUsernameStatus.hidden = true;
      profileUsernameStatus.textContent = "";
      profileUsernameStatus.dataset.state = "";
    }
    profileSchool.value = p?.school || "";
    profilePhone.value = p?.phone || "";
    profileExamYear.value = p?.exam_year || "";
    profileStream.value = p?.study_stream || "";
    selectedGender = ["male", "female"].includes(p?.gender) ? p.gender : "";
    genderButtons.forEach(button => {
      const active = button.dataset.profileGender === selectedGender;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  function normalizeDisplayName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function setNameStatus(message, state = "error") {
    if (!profileNameStatus) return;
    profileNameStatus.textContent = message;
    profileNameStatus.dataset.state = state;
    profileNameStatus.style.setProperty("color", state === "error" ? "#ff626f" : state === "success" ? "#35c98a" : "var(--text-secondary)", "important");
    profileNameStatus.hidden = !message;
  }

  async function checkNameAvailability() {
    const name = normalizeDisplayName(profileInput?.value);
    const normalizedName = name.toLowerCase();
    const sequence = ++nameCheckSequence;
    if (nameCheckTimer) window.clearTimeout(nameCheckTimer);
    if (!name) {
      setNameStatus("");
      return false;
    }
    if (name.length < 2) {
      setNameStatus("Enter at least 2 characters for your name.");
      return false;
    }
    if (name.length > 60) {
      setNameStatus("Please keep your name under 60 characters.");
      return false;
    }
    if (/^Student\d{4}$/.test(name)) {
      setNameStatus("Please enter your real display name.");
      return false;
    }
    if (normalizedName === savedDisplayName) {
      setNameStatus("");
      return true;
    }
    setNameStatus("Checking name…", "checking");
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("Account is unavailable");
      await account.ready;
      const { data, error } = await account.client.rpc("studylab_display_name_available", {
        p_display_name: name
      });
      if (sequence !== nameCheckSequence) return false;
      if (error) throw error;
      if (data !== true) {
        setNameStatus("That name is already in use. Please choose another.");
        return false;
      }
      setNameStatus("Name is available.", "success");
      return true;
    } catch (error) {
      if (sequence !== nameCheckSequence) return false;
      console.warn("StudyLab name availability check:", error);
      setNameStatus("Could not check name availability. It will be verified when you save.");
      return false;
    }
  }

  function scheduleNameAvailabilityCheck() {
    nameCheckSequence++;
    if (nameCheckTimer) window.clearTimeout(nameCheckTimer);
    const name = normalizeDisplayName(profileInput?.value);
    if (!name || name.toLowerCase() === savedDisplayName) {
      setNameStatus("");
      return;
    }
    if (name.length < 2) {
      setNameStatus("Enter at least 2 characters for your name.");
      return;
    }
    if (name.length > 60) {
      setNameStatus("Please keep your name under 60 characters.");
      return;
    }
    if (/^Student\d{4}$/.test(name)) {
      setNameStatus("Please enter your real display name.");
      return;
    }
    setNameStatus("Checking name…", "checking");
    nameCheckTimer = window.setTimeout(() => { checkNameAvailability(); }, 250);
  }

  function setUsernameStatus(message, state = "error") {
    if (!profileUsernameStatus) return;
    profileUsernameStatus.textContent = message;
    profileUsernameStatus.dataset.state = state;
    profileUsernameStatus.style.setProperty("color", state === "error" ? "#ff626f" : state === "success" ? "#35c98a" : "var(--text-secondary)", "important");
    profileUsernameStatus.hidden = !message;
  }

  async function checkUsernameAvailability() {
    const username = String(profileUsername?.value || "").trim().toLowerCase();
    const sequence = ++usernameCheckSequence;
    if (usernameCheckTimer) window.clearTimeout(usernameCheckTimer);
    if (!username) {
      setUsernameStatus("");
      return false;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setUsernameStatus("Use 3–24 lowercase letters, numbers, or underscores.");
      return false;
    }
    if (username === savedUsername) {
      setUsernameStatus("");
      return true;
    }
    setUsernameStatus("Checking username…", "checking");
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("Account is unavailable");
      await account.ready;
      const { data, error } = await account.client.rpc("studylab_username_available", {
        p_username: username
      });
      if (sequence !== usernameCheckSequence) return false;
      if (error) throw error;
      if (data !== true) {
        setUsernameStatus("That username is already taken. Please choose another.");
        return false;
      }
      setUsernameStatus("Username is available.", "success");
      return true;
    } catch (error) {
      if (sequence !== usernameCheckSequence) return false;
      console.warn("StudyLab username availability check:", error);
      setUsernameStatus("Could not check username availability. It will be verified when you save.");
      return false;
    }
  }

  function scheduleUsernameAvailabilityCheck() {
    usernameCheckSequence++;
    if (usernameCheckTimer) window.clearTimeout(usernameCheckTimer);
    const username = String(profileUsername?.value || "").trim().toLowerCase();
    if (!username || !/^[a-z0-9_]{3,24}$/.test(username) || username === savedUsername) {
      usernameCheckSequence++;
      setUsernameStatus("");
      if (username && username === savedUsername) return;
      if (username && !/^[a-z0-9_]{3,24}$/.test(username)) {
        setUsernameStatus("Use 3–24 lowercase letters, numbers, or underscores.");
      }
      return;
    }
    setUsernameStatus("Checking username…", "checking");
    usernameCheckTimer = window.setTimeout(() => { checkUsernameAvailability(); }, 250);
  }

  function updateStudyRoomValidation() {
    if (!mandatoryProfile) {
      [profileInput, profileSchool, profilePhone, profileExamYear, profileStream].forEach(field => {
        field?.classList.remove("profile-field-invalid");
        field?.removeAttribute("aria-invalid");
      });
      document.querySelector(".profile-gender-field")?.classList.remove("profile-field-invalid");
      genderButtons.forEach(button => button.classList.remove("profile-field-invalid"));
      return;
    }

    const phoneDigits = profilePhone.value.replace(/\\D/g, "");
    const invalid = {
      name: profileInput.value.trim().length < 2 || placeholderName(profileInput.value.trim()),
      school: profileSchool.value.trim().length < 2,
      phone: !profilePhone.value.trim() || phoneDigits.length < 9 || phoneDigits.length > 12,
      year: !profileExamYear.value,
      stream: !profileStream.value,
      icon: !["male", "female"].includes(selectedGender)
    };
    const fields = [
      [profileInput, invalid.name],
      [profileSchool, invalid.school],
      [profilePhone, invalid.phone],
      [profileExamYear, invalid.year],
      [profileStream, invalid.stream]
    ];
    fields.forEach(([field, isInvalid]) => {
      field.classList.toggle("profile-field-invalid", isInvalid);
      field.setAttribute("aria-invalid", String(isInvalid));
    });
    const iconField = document.querySelector(".profile-gender-field");
    iconField?.classList.toggle("profile-field-invalid", invalid.icon);
    genderButtons.forEach(button => {
      button.classList.toggle("profile-field-invalid", invalid.icon);
      button.setAttribute("aria-invalid", String(invalid.icon));
    });
  }

  function updateCopy(p) {
    const complete = mandatoryProfile ? isFullComplete(p) : isBasicComplete(p);
    profileNameLabel.textContent = complete ? "Your student profile"
      : onboardingAuthIntent === "signup" ? "Finish creating your StudyLab profile" : "Complete your student profile";
    profileSubtitle.textContent = mandatoryProfile
      ? "All details are required to enter the Study Room."
      : complete
        ? "Keep your details up to date. Your information stays linked to your StudyLab account."
        : onboardingAuthIntent === "signup"
          ? "Your Google account is connected. Add your student details to finish setting up StudyLab."
          : "Add your name, A/L year and stream. You can skip this for now and keep using StudyLab.";
    const submit = profileForm.querySelector(".profile-save");
    if (submit) submit.textContent = complete ? "Save changes" : "Save profile";
  }
  async function openModal() {
    closeAccountMenu();
    profileStatus.hidden = true;
    profileStatus.textContent = "";
    profileStatus.dataset.state = "success";
    profileButton.disabled = true;
    mandatoryProfile = requireFullProfile;
    updateRequiredFields();
    try {
      const p = await getCloudProfile(true);
      mandatoryProfile = requireFullProfile && !isFullComplete(p);
      updateRequiredFields();
      fillForm(p);
      updateCopy(p);
      updateStudyRoomValidation();
      if (mandatoryProfile) {
        showStatus("To enter the Study Room, you must fill in all fields, including your profile icon.", true);
      }
      setButtonProfile(p);
    } catch (error) {
      console.warn("StudyLab profile load:", error);
      showStatus("Could not load your cloud profile. Check your connection and try again.", true);
      profileNameLabel.textContent = "Student profile";
      profileSubtitle.textContent = "Your account details could not be loaded.";
    } finally {
      profileButton.disabled = false;
    }
    profileModal.hidden = false;
    profileModal.classList.remove("is-closing");
    profileModal.classList.add("is-opening");
    document.body.classList.add("profile-modal-open");
    window.requestAnimationFrame(() => profileInput.focus());
    window.setTimeout(() => profileModal.classList.remove("is-opening"), 460);
  }
  function closeModal(animate = true) {
    if (mandatoryProfile) return;
    if (closeTimer) window.clearTimeout(closeTimer);
    if (animate && !profileModal.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      profileModal.classList.remove("is-opening");
      profileModal.classList.add("is-closing");
      closeTimer = window.setTimeout(() => {
        profileModal.hidden = true;
        profileModal.classList.remove("is-closing");
        document.body.classList.remove("profile-modal-open");
        closeTimer = null;
      }, 340);
      return;
    }
    profileModal.hidden = true;
    profileModal.classList.remove("is-opening", "is-closing");
    document.body.classList.remove("profile-modal-open");
  }
  function signalPetField(field) {
    const fieldName = field === profileInput ? "name"
      : field === profileSchool ? "school"
      : field === profilePhone ? "phone"
      : field === profileExamYear ? "year"
      : field === profileStream ? "stream" : "idle";
    window.dispatchEvent(new CustomEvent("studylab-profile-field", {
      detail: { field: fieldName, value: field?.value || "" }
    }));
  }


  profileFields.forEach(field => {
    field.addEventListener("focus", () => signalPetField(field));
    field.addEventListener("input", () => signalPetField(field));
    field.addEventListener("change", () => signalPetField(field));
  });
  profileModal.addEventListener("pointermove", event => {
    if (!profileDialog || profileModal.hidden || event.pointerType === "touch" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = profileDialog.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    profileModal.style.setProperty("--profile-glow-x", (clampedX * 100) + "%");
    profileModal.style.setProperty("--profile-glow-y", (clampedY * 100) + "%");
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      profileDialog.style.transform = "";
      return;
    }
    const tiltX = (0.5 - clampedY) * 2.2;
    const tiltY = (clampedX - 0.5) * 2.2;
    profileDialog.style.transform = "perspective(1200px) rotateX(" + tiltX.toFixed(2) + "deg) rotateY(" + tiltY.toFixed(2) + "deg)";
  });
  profileModal.addEventListener("pointerleave", () => {
    if (profileDialog) profileDialog.style.transform = "";
    profileModal.style.setProperty("--profile-glow-x", "50%");
    profileModal.style.setProperty("--profile-glow-y", "10%");
  });

  genderButtons.forEach(button => button.addEventListener("click", () => {
    selectedGender = button.dataset.profileGender;
    genderButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle("is-selected", active);
      item.setAttribute("aria-pressed", String(active));
    });
    updateStudyRoomValidation();
  }));

  [profileInput, profileSchool, profilePhone, profileExamYear, profileStream].forEach(field => {
    field.addEventListener("input", updateStudyRoomValidation);
    field.addEventListener("change", updateStudyRoomValidation);
  });

  profileButton.addEventListener("click", toggleAccountMenu);
  profileInput?.addEventListener("input", scheduleNameAvailabilityCheck);
  profileInput?.addEventListener("change", checkNameAvailability);
  profileUsername?.addEventListener("input", scheduleUsernameAvailabilityCheck);
  profileUsername?.addEventListener("change", checkUsernameAvailability);
  profileClose?.addEventListener("click", closeModal);
  profileModal.addEventListener("click", event => {
    if (event.target === profileModal) closeModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !profileModal.hidden) closeModal();
  });

  profileForm.addEventListener("submit", async event => {
    event.preventDefault();
    profileStatus.hidden = true;
    const name = profileInput.value.trim().replace(/\s+/g, " ");
    const username = profileUsername.value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      showStatus("Username must be 3–24 characters using lowercase letters, numbers, or underscores.", true);
      profileUsername.focus();
      return;
    }
    if (username !== savedUsername) {
      const usernameAvailable = await checkUsernameAvailability();
      if (!usernameAvailable) {
        showStatus(profileUsernameStatus?.textContent || "Please choose an available username.", true);
        profileUsername.focus();
        return;
      }
    }
    if (name.length < 2) {
      showStatus("Please enter your full name.", true);
      profileInput.focus();
      return;
    }
    if (name.length > 60) {
      showStatus("Please keep your name under 60 characters.", true);
      profileInput.focus();
      return;
    }
    if (name.toLowerCase() !== savedDisplayName) {
      const nameAvailable = await checkNameAvailability();
      if (!nameAvailable) {
        showStatus(profileNameStatus?.textContent || "Please choose an available name.", true);
        profileInput.focus();
        return;
      }
    }
    const school = profileSchool.value.trim().replace(/\s+/g, " ");
    const phone = profilePhone.value.trim();
    if (mandatoryProfile && school.length < 2) {
      showStatus("Please enter your school name.", true);
      profileSchool.focus();
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phone && (phoneDigits.length < 9 || phoneDigits.length > 12)) {
      showStatus("Please enter a valid mobile number (9–12 digits, including country code if used).", true);
      profilePhone.focus();
      return;
    }
    if (mandatoryProfile && !phone) {
      showStatus("Please enter your mobile number.", true);
      profilePhone.focus();
      return;
    }
    if (!profileExamYear.value || !profileStream.value) {
      showStatus("Please choose your A/L examination year and study stream.", true);
      return;
    }

    if (mandatoryProfile && !["male", "female"].includes(selectedGender)) {
      showStatus("Please choose a profile icon.", true);
      genderButtons[0]?.focus();
      return;
    }

    const submit = profileForm.querySelector(".profile-save");
    if (submit) submit.disabled = true;
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("StudyLab account is unavailable.");
      await account.ready;
      const p = await account.saveProfile(name, {
        username,
        school,
        phone,
        exam_year: profileExamYear.value,
        study_stream: profileStream.value,
        gender: selectedGender,
        require_full_profile: mandatoryProfile
      });
      fillForm(p);
      savedDisplayName = normalizeDisplayName(p?.display_name).toLowerCase();
      savedUsername = String(p?.username || "").trim().toLowerCase();
      setButtonProfile(p);
      updateCopy(p);
      mandatoryProfile = false;
      updateRequiredFields();
      updateStudyRoomValidation();
      profileStatus.hidden = true;
      profileStatus.textContent = "";
      window.dispatchEvent(new CustomEvent("studylab-profile-updated", { detail: p }));
      window.setTimeout(() => {
        closeModal(true);
        const params = new URLSearchParams(window.location.search);
        // On the Study Room page, close the modal in place so the room appears
        // immediately behind it. The redirect is only for legacy home-page gates.
        if (!window.location.pathname.endsWith("/study-room.html") &&
            params.get("completeProfile") === "1") {
          const returnTo = params.get("returnTo") || "";
          if (returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\")) {
            window.setTimeout(() => window.location.replace(returnTo), 380);
          }
        }
      }, 420);
    } catch (error) {
      console.warn("StudyLab profile save:", error);
      showStatus(error?.message || "Your profile could not be saved. Please try again.", true);
      if (submit) submit.textContent = "Try saving again";
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Save profile"; }
    }
  });

  (async function boot() {
    try {
      onboardingAuthIntent = window.StudyLabAccount?.getAuthIntent?.() || "";
      const p = await getCloudProfile();
      setButtonProfile(p);
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo") || "";
      const isStudyRoomPage = window.location.pathname.endsWith("/study-room.html");
      requireFullProfile = isStudyRoomPage || (params.get("completeProfile") === "1" &&
        returnTo.startsWith("/study-room.html") && !returnTo.startsWith("//") && !returnTo.includes("\\"));
      if (requireFullProfile && !isFullComplete(p)) {
        await openModal();
        showStudyRoomGateToast();
      } else if (!requireFullProfile && !isBasicComplete(p)) {
        await openModal();
      }
      window.StudyLabAccount?.clearAuthIntent?.();
      onboardingAuthIntent = "";
    } catch (error) {
      console.warn("StudyLab profile startup:", error);
      setButtonProfile(null);
    }
  })();
})();
