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
  const profileFields = [profileInput, profileSchool, profilePhone, profileExamYear, profileStream];
  let closeTimer = null;
  let mandatoryProfile = false;
  let requireFullProfile = false;

  const profileClose = document.getElementById("profileClose");
  const profileSkip = document.getElementById("profileSkip");

  if (!profileButton || !profileModal || !profileForm || !profileInput) return;

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
    if (profileSkip) profileSkip.hidden = mandatoryProfile;
  }

  function setButtonProfile(p) {
    if (isBasicComplete(p)) {
      profileButton.textContent = "👤 " + p.display_name;
      profileButton.title = "Edit your student profile";
    } else if (p?.display_name && !placeholderName(p.display_name)) {
      profileButton.textContent = "👤 Complete Profile";
      profileButton.title = "Finish setting up your student profile";
    } else {
      profileButton.textContent = "👤 Create Profile";
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
    profileInput.value = p?.display_name && !placeholderName(p.display_name) ? p.display_name : "";
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
  }));

  profileButton.addEventListener("click", openModal);
  profileClose?.addEventListener("click", closeModal);
  profileSkip?.addEventListener("click", closeModal);
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
    if (submit) { submit.disabled = true; submit.textContent = "Saving securely…"; }
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("StudyLab account is unavailable.");
      await account.ready;
      const p = await account.saveProfile(name, {
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
      showStatus("Your profile has been saved to your StudyLab account ✓");
      window.dispatchEvent(new CustomEvent("studylab-profile-updated", { detail: p }));
      window.setTimeout(() => {
        closeModal(true);
        const params = new URLSearchParams(window.location.search);
        if (params.get("completeProfile") === "1") {
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
      if (submit) submit.disabled = false;
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
      if (requireFullProfile ? !isFullComplete(p) : !isBasicComplete(p)) {
        await openModal();
      }
    } catch (error) {
      console.warn("StudyLab profile startup:", error);
      profileButton.textContent = "👤 Create Profile";
    }
  })();
})();
