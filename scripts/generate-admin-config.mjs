import { writeFileSync } from "node:fs";
// Deploy/branch previews can NEVER enable live admin mutations.
const mode =
  process.env.CONTEXT === "production" &&
  process.env.STUDYLAB_ADMIN_LIVE === "true"
    ? "live"
    : "preview";
writeFileSync(
  "assets/js/studylab-admin-config.js",
  `window.StudyLabAdminConfig = Object.freeze(${JSON.stringify({ mode })});\n`,
);
console.log(`Admin dashboard: ${mode}`);
