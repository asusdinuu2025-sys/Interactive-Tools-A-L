/*
 * Study-Lab simple profile
 * No passwords, email or phone numbers.
 * Students' names are saved locally on their browser.
 *
 * To send newly-created names to your Google Sheet, paste your
 * Google Apps Script Web App URL into PROFILE_ENDPOINT below.
 */
const PROFILE_ENDPOINT = "";

(function () {
  "use strict";

  const STORAGE_KEY = "studyLabProfile";
  const profileButton = document.getElementById("profileButton");
  const profileModal = document.getElementById("profileModal");
  const profileForm = document.getElementById("profileForm");
  const profileInput = document.getElementById("profileName");
  const profileStatus = document.getElementById("profileStatus");
  const profileNameLabel = document.getElementById("profileNameLabel");
  const profileClose = document.getElementById("profileClose");
  const profileCancel = document.getElementById("profileCancel");

  if (!profileButton || !profileModal || !profileForm || !profileInput) return;

  function getProfile() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
    } catch {
      return null;
    }
  }

  function saveLocalProfile(name, id) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      id,
      name,
      createdAt: new Date().toISOString()
    }));
  }

  function openModal() {
    const profile = getProfile();
    profileStatus.textContent = "";
    profileStatus.hidden = true;

    if (profile?.name) {
      profileInput.value = profile.name;
      profileNameLabel.textContent = "Your Study-Lab profile";
      profileButton.textContent = "👤 " + profile.name;
    } else {
      profileInput.value = "";
      profileNameLabel.textContent = "Create your Study-Lab profile";
      profileButton.textContent = "👤 Create Profile";
    }

    profileModal.hidden = false;
    document.body.classList.add("profile-modal-open");
    requestAnimationFrame(() => profileInput.focus());
  }

  function closeModal() {
    profileModal.hidden = true;
    document.body.classList.remove("profile-modal-open");
  }

  async function sendToSheet(name, id) {
    if (!PROFILE_ENDPOINT) return;

    try {
      await fetch(PROFILE_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ name, id })
      });
    } catch (error) {
      console.warn("Study-Lab profile could not reach the name-list service.", error);
    }
  }

  profileButton.addEventListener("click", openModal);
  profileClose?.addEventListener("click", closeModal);
  profileCancel?.addEventListener("click", closeModal);

  profileModal.addEventListener("click", (event) => {
    if (event.target === profileModal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !profileModal.hidden) closeModal();
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = profileInput.value.trim().replace(/\s+/g, " ");
    if (name.length < 2) {
      profileStatus.textContent = "Please enter your name.";
      profileStatus.hidden = false;
      profileInput.focus();
      return;
    }

    if (name.length > 60) {
      profileStatus.textContent = "Please keep your name under 60 characters.";
      profileStatus.hidden = false;
      return;
    }

    const existing = getProfile();
    const id = existing?.id || (crypto.randomUUID ? crypto.randomUUID() : "sl-" + Date.now() + "-" + Math.random().toString(36).slice(2));

    saveLocalProfile(name, id);
    profileButton.textContent = "👤 " + name;

    await sendToSheet(name, id);

    profileStatus.textContent = PROFILE_ENDPOINT
      ? "Profile saved ✓"
      : "Profile saved on this device ✓";
    profileStatus.hidden = false;

    setTimeout(closeModal, 700);
  });

  const existing = getProfile();
  if (existing?.name) {
    profileButton.textContent = "👤 " + existing.name;
  }
})();
