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
  const profileStatus = document.getElementById("profileStatus");
  const profileNameLabel = document.getElementById("profileNameLabel");
  const profileSubtitle = document.getElementById("profileSubtitle");
  const profileClose = document.getElementById("profileClose");
  const PROFILE_PROMPT_KEY = "studylabProfileCompletionPromptSeenV1";

  if (!profileButton || !profileModal || !profileForm || !profileInput) return;

  const placeholderName = name => /^Student\d{4}$/.test(String(name || ""));
  const isComplete = p => Boolean(p?.profile_completed_at && p?.display_name &&
    !placeholderName(p.display_name) && p?.exam_year && p?.study_stream);

  function markPromptSeen() {
    try { localStorage.setItem(PROFILE_PROMPT_KEY, "1"); } catch (_) {}
  }
  function hasSeenPrompt() {
    try { return localStorage.getItem(PROFILE_PROMPT_KEY) === "1"; } catch (_) { return false; }
  }
  function setButtonProfile(p) {
    if (isComplete(p)) {
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
  }
  function updateCopy(p) {
    const complete = isComplete(p);
    profileNameLabel.textContent = complete ? "Your student profile" : "Complete your student profile";
    profileSubtitle.textContent = complete
      ? "Keep your details up to date. Your information stays linked to your StudyLab account."
      : "A few details help StudyLab tailor the experience to your Sri Lankan A/L study needs.";
    const submit = profileForm.querySelector(".profile-save");
    if (submit) submit.textContent = complete ? "Save changes" : "Save profile";
  }
  async function openModal() {
    profileStatus.hidden = true;
    profileStatus.textContent = "";
    profileStatus.dataset.state = "success";
    profileButton.disabled = true;
    try {
      const p = await getCloudProfile(true);
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
    document.body.classList.add("profile-modal-open");
    window.requestAnimationFrame(() => profileInput.focus());
  }
  function closeModal() {
    profileModal.hidden = true;
    document.body.classList.remove("profile-modal-open");
  }

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
    if (!profileExamYear.value || !profileStream.value) {
      showStatus("Please choose your A/L examination year and study stream.", true);
      return;
    }

    const submit = profileForm.querySelector(".profile-save");
    if (submit) { submit.disabled = true; submit.textContent = "Saving securely…"; }
    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("StudyLab account is unavailable.");
      await account.ready;
      const p = await account.saveProfile(name, {
        school: profileSchool.value,
        phone: profilePhone.value,
        exam_year: profileExamYear.value,
        study_stream: profileStream.value
      });
      fillForm(p);
      setButtonProfile(p);
      updateCopy(p);
      markPromptSeen();
      showStatus("Your profile has been saved to your StudyLab account ✓");
      window.dispatchEvent(new CustomEvent("studylab-profile-updated", { detail: p }));
      window.setTimeout(closeModal, 900);
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
      if (!isComplete(p) && !hasSeenPrompt()) {
        markPromptSeen();
        await openModal();
      }
    } catch (error) {
      console.warn("StudyLab profile startup:", error);
      profileButton.textContent = "👤 Create Profile";
    }
  })();
})();
