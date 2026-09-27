/* =========================================================
   STUDY LAB — STUDENT MILESTONE
   Reads only the aggregate student-profile count.
   ========================================================= */

(function () {
  "use strict";

  const totalElement = document.querySelector("[data-student-total]");
  const nextElement = document.querySelector("[data-student-next]");
  const progressElement = document.querySelector("[data-student-progress]");
  const progressBar = progressElement?.closest("[role='progressbar']");

  if (!totalElement || !nextElement || !progressElement) return;

  const MILESTONES = [
    10, 25, 50, 100, 250, 500, 1000, 1500, 2000,
    5000, 10000, 25000, 50000, 100000
  ];

  function getNextMilestone(count) {
    for (const milestone of MILESTONES) {
      if (count < milestone) return milestone;
    }

    const step = 100000;
    return Math.ceil((count + 1) / step) * step;
  }

  function getPreviousMilestone(count) {
    let previous = 0;

    for (const milestone of MILESTONES) {
      if (count < milestone) return previous;
      previous = milestone;
    }

    const step = 100000;
    return Math.floor(count / step) * step;
  }

  function formatNumber(value) {
    return Number(value).toLocaleString();
  }

  function updateCard(count) {
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    const next = getNextMilestone(safeCount);
    const previous = getPreviousMilestone(safeCount);
    const span = next - previous;

    const progress =
      span > 0
        ? Math.min(100, Math.max(0, ((safeCount - previous) / span) * 100))
        : 0;

    totalElement.textContent = formatNumber(safeCount);
    nextElement.textContent =
      "Next milestone: " + formatNumber(next) + " students";

    progressElement.style.width = progress.toFixed(1) + "%";

    if (progressBar) {
      progressBar.setAttribute("aria-valuenow", String(Math.round(progress)));
      progressBar.setAttribute(
        "aria-valuetext",
        Math.round(progress) + "% to " + formatNumber(next) + " students"
      );
    }
  }

  async function loadCount() {
    try {
      const account = window.StudyLabAccount;

      if (!account?.client) {
        throw new Error("Supabase client unavailable.");
      }

      await account.ready;

      const { data, error } = await account.client.rpc(
        "studylab_public_student_count"
      );

      if (error) throw error;

      updateCard(data);
    } catch (error) {
      console.warn("StudyLab student milestone:", error);
      totalElement.textContent = "—";
      nextElement.textContent = "Student milestone count unavailable";
      progressElement.style.width = "0%";

      if (progressBar) {
        progressBar.setAttribute("aria-valuenow", "0");
        progressBar.setAttribute("aria-valuetext", "Unavailable");
      }
    }
  }

  void loadCount();

  window.addEventListener("studylab-profile-updated", () => {
    void loadCount();
  });

  window.setInterval(() => {
    void loadCount();
  }, 60000);
})();
