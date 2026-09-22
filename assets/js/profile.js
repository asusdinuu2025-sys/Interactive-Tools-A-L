/*
 * Study-Lab cloud student profile.
 *
 * The visible name is stored in Supabase and tied to the
 * anonymous Supabase student account. No password, email, or
 * phone number is required.
 */

(function () {
  "use strict";

  const profileButton = document.getElementById("profileButton");
  const profileModal = document.getElementById("profileModal");
  const profileForm = document.getElementById("profileForm");
  const profileInput = document.getElementById("profileName");
  const profileStatus = document.getElementById("profileStatus");
  const profileNameLabel = document.getElementById("profileNameLabel");
  const profileClose = document.getElementById("profileClose");
  const profileCancel = document.getElementById("profileCancel");

  if (!profileButton || !profileModal || !profileForm || !profileInput) return;

  function setButtonName(name) {
    profileButton.textContent = name
      ? "👤 " + name
      : "👤 Create Profile";
  }

  function showStatus(message, isError = false) {
    if (!profileStatus) return;
    profileStatus.textContent = message;
    profileStatus.hidden = false;
    profileStatus.dataset.state = isError ? "error" : "success";
  }

  async function getCloudProfile() {
    const account = window.StudyLabAccount;
    if (!account?.ready) {
      throw new Error("StudyLab account is still starting.");
    }

    await account.ready;
    return account.getProfile();
  }

  async function openModal() {
    profileStatus.hidden = true;
    profileStatus.textContent = "";

    try {
      const profile = await getCloudProfile();

      if (profile?.display_name) {
        profileInput.value = profile.display_name;
        profileNameLabel.textContent = "Your Study-Lab profile";
        setButtonName(profile.display_name);
      } else {
        profileInput.value = "";
        profileNameLabel.textContent = "Create your Study-Lab profile";
        setButtonName("");
      }
    } catch (error) {
      console.warn("StudyLab profile:", error);
      profileInput.value = "";
      profileNameLabel.textContent = "Create your Study-Lab profile";
      showStatus(
        "Cloud profile is not ready. Enable Anonymous Sign-Ins in Supabase and run the backend SQL.",
        true
      );
      setButtonName("");
    }

    profileModal.hidden = false;
    document.body.classList.add("profile-modal-open");

    requestAnimationFrame(() => {
      profileInput.focus();
      profileInput.select?.();
    });
  }

  function closeModal() {
    profileModal.hidden = true;
    document.body.classList.remove("profile-modal-open");
  }

  profileButton.addEventListener("click", openModal);
  profileClose?.addEventListener("click", closeModal);
  profileCancel?.addEventListener("click", closeModal);

  profileModal.addEventListener("click", event => {
    if (event.target === profileModal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !profileModal.hidden) {
      closeModal();
    }
  });

  profileForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = profileInput.value.trim().replace(/\s+/g, " ");

    if (name.length < 2) {
      showStatus("Please enter your name.", true);
      profileInput.focus();
      return;
    }

    if (name.length > 60) {
      showStatus("Please keep your name under 60 characters.", true);
      return;
    }

    const submitButton = profileForm.querySelector(".profile-save");
    if (submitButton) submitButton.disabled = true;

    try {
      const account = window.StudyLabAccount;
      if (!account?.ready) throw new Error("StudyLab account is unavailable.");

      await account.ready;
      const profile = await account.saveProfile(name);

      setButtonName(profile.display_name);
      profileNameLabel.textContent = "Your Study-Lab profile";
      showStatus("Profile synced to your StudyLab account ✓");

      window.dispatchEvent(new CustomEvent("studylab-profile-updated", {
        detail: profile
      }));

      window.setTimeout(closeModal, 800);
    } catch (error) {
      console.warn("StudyLab profile save:", error);
      showStatus(
        error?.message || "Profile could not be synced right now.",
        true
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  (async function boot() {
    try {
      const profile = await getCloudProfile();

      if (profile?.display_name) {
        setButtonName(profile.display_name);
      }
    } catch (error) {
      console.warn("StudyLab profile startup:", error);
    }
  })();
})();
