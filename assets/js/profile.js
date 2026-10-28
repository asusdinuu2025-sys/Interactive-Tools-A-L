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
  const profileUsername = document.getElementById("profileUsername");
  const profileSchool = document.getElementById("profileSchool");
  const profilePhone = document.getElementById("profilePhone");
  const profileExamYear = document.getElementById("profileExamYear");
  const profileStream = document.getElementById("profileStream");
  const genderButtons = [...document.querySelectorAll("[data-profile-gender]")];
  let selectedGender = "";
  const profileStatus = document.getElementById("profileStatus");
  const profileNameLabel = document.getElementById("profileNameLabel");
  const profileSubtitle = document.getElementById("profileSubtitle");
  const profileDialog = profileModal.querySelector(".profile-dialog");
  const profileFields = [profileInput, profileUsername, profileSchool, profilePhone, profileExamYear, profileStream];
  let closeTimer = null;
  let mandatoryProfile = false;
  let requireFullProfile = false;

  const profileClose = document.getElementById("profileClose");

  if (!profileButton || !profileModal || !profileForm || !profileInput) return;

  const placeholderName = name => /^Student\d{4}$/.test(String(name || ""));
  const isBasicComplete = p => Boolean(p?.display_name && !placeholderName(p.display_name) &&
    p?.exam_year && p?.study_stream);
  const isFullComplete = p => Boolean(p?.profile_completed_at && isBasicComplete(p) &&
    String(p.school || "").trim() && String(p.phone || "").trim() &&
    ["male", "female"].includes(p?.gender));
  const isComplete = isFullComplete;

  const nameAvailability = document.createElement("p");
  nameAvailability.id = "profileNameAvailability";
  nameAvailability.className = "profile-name-availability";
  nameAvailability.setAttribute("role", "status");
  nameAvailability.setAttribute("aria-live", "polite");
  nameAvailability.dataset.state = "";
  profileInput.insertAdjacentElement("afterend", nameAvailability);

  const nameAvailabilityStyle = document.createElement("style");
  nameAvailabilityStyle.textContent = `
    .profile-name-availability{min-height:1.15em;margin:6px 0 0;font-size:.78rem;line-height:1.4}
    .profile-name-availability:empty{display:none}
    .profile-name-availability[data-state="checking"]{color:var(--text-muted,#91a0b6)}
    .profile-name-availability[data-state="available"]{color:#31c994}
    .profile-name-availability[data-state="taken"]{color:#ff6685}
    .profile-name-availability[data-state="error"]{color:#d7a957}
  `;
  document.head.appendChild(nameAvailabilityStyle);

  let nameCheckTimer = null;
  let nameCheckVersion = 0;
  function setNameAvailability(message, state) {
    nameAvailability.textContent = message;
    nameAvailability.dataset.state = state || "";
  }
  function clearNameAvailability() {
    nameCheckVersion++;
    if (nameCheckTimer) window.clearTimeout(nameCheckTimer);
    nameCheckTimer = null;
    setNameAvailability("", "");
  }
  function scheduleNameAvailabilityCheck() {
    if (profileStatus.textContent.startsWith("Name already taken.")) profileStatus.hidden = true;
    if (nameCheckTimer) window.clearTimeout(nameCheckTimer);
    const version = ++nameCheckVersion;
    const name = profileInput.value.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60 || placeholderName(name)) {
      setNameAvailability("", "");
      return;
    }
    setNameAvailability("Checking name availability…", "checking");
    nameCheckTimer = window.setTimeout(async () => {
      try {
        const account = window.StudyLabAccount;
        if (!account?.ready) throw new Error("StudyLab account is unavailable.");
        await account.ready;
        const available = await account.checkDisplayNameAvailable(name);
        if (version !== nameCheckVersion ||
            profileInput.value.trim().replace(/\s+/g, " ") !== name) return;
        setNameAvailability(
          available ? "Name available." : "Name already taken. Enter more of your name or try a new one.",
          available ? "available" : "taken"
        );
      } catch (error) {
        if (version !== nameCheckVersion) return;
        setNameAvailability("Could not check right now. The name will be verified when you save.", "error");
      }
    }, 350);
  }

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

  const profileIconStyle = document.createElement("style");
  profileIconStyle.textContent = '.profile-button .header-action-icon{display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 20px} .profile-button .header-action-icon-female{color:#ff4fa3!important} .profile-button .header-action-icon-male{color:#39a8ff!important} .profile-button .header-action-icon svg{width:20px;height:20px;fill:none;stroke:currentColor!important;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 2px currentColor) drop-shadow(0 0 4px currentColor)}';
  document.head.appendChild(profileIconStyle);
  function setButtonProfile(p) {
    const gender = p?.gender === "female" ? "female" : "male";
    const icon = gender === "female"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="7" r="3.2"/><path d="M7 20l1-4.2a4.1 4.1 0 0 1 8 0l1 4.2z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="7" r="3.2"/><path d="M4.5 20v-2.5a7.5 7.5 0 0 1 15 0V20z"/></svg>';
    profileButton.innerHTML = '<span class="header-action-icon header-action-icon-' + gender + '\" aria-hidden="true">' + icon + '</span><span class="profile-button-label"></span>';
    const label = profileButton.querySelector(".profile-button-label");
    if (isBasicComplete(p)) {
      label.textContent = p.display_name;
      profileButton.title = "Edit your student profile";
    } else if (p?.display_name && !placeholderName(p.display_name)) {
      label.textContent = "Complete Profile";
      profileButton.title = "Finish setting up your student profile";
    } else {
      label.textContent = "Create Profile";
      profileButton.title = "Create your student profile";
    }
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
    clearNameAvailability();
    profileInput.value = p?.display_name && !placeholderName(p.display_name) ? p.display_name : "";
    profileUsername.value = p?.username || "";
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
    profileNameLabel.textContent = complete ? "Your student profile" : "Complete your student profile";
    profileSubtitle.textContent = mandatoryProfile
      ? "All details are required to enter the Study Room."
      : complete
        ? "Keep your details up to date. Your information stays linked to your StudyLab account."
        : "Add your name, A/L year and stream. You can skip this for now and keep using StudyLab.";
    const submit = profileForm.querySelector(".profile-save");
    if (submit) submit.textContent = complete ? "Save changes" : "Save profile";
  }
  async function openModal() {
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
  profileInput.addEventListener("input", scheduleNameAvailabilityCheck);
  profileInput.addEventListener("change", scheduleNameAvailabilityCheck);

  profileButton.addEventListener("click", openModal);
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
      try {
        const available = await account.checkDisplayNameAvailable(name);
        if (!available) {
          const message = "Name already taken. Enter more of your name or try a new one.";
          setNameAvailability(message, "taken");
          showStatus(message, true);
          profileInput.focus();
          return;
        }
      } catch (availabilityError) {
        // The database trigger remains the final authority if the live check is temporarily unavailable.
        console.warn("StudyLab display-name check:", availabilityError);
      }
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
      const errorMessage = error?.message || "Your profile could not be saved. Please try again.";
      if (errorMessage.startsWith("Name already taken.")) setNameAvailability(errorMessage, "taken");
      showStatus(errorMessage, true);
      if (submit) submit.textContent = "Try saving again";
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = "Save profile"; }
    }
  });

  (async function boot() {
    try {
      const p = await getCloudProfile();
      setButtonProfile(p);
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo") || "";
      requireFullProfile = params.get("completeProfile") === "1" &&
        returnTo.startsWith("/study-room.html") && !returnTo.startsWith("//") && !returnTo.includes("\\");
      if (requireFullProfile && !isFullComplete(p)) {
        await openModal();
        showStudyRoomGateToast();
      } else if (!requireFullProfile && !isBasicComplete(p)) {
        await openModal();
      }
    } catch (error) {
      console.warn("StudyLab profile startup:", error);
      setButtonProfile(null);
    }
  })();
})();
