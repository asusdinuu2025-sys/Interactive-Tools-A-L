import { writeFileSync } from "node:fs";

// The owner has approved full PR #102 for production. The client mode
// enables the admin interface only: Supabase still independently verifies
// authenticated admin membership for every read and write RPC and storage action.
// Unrelated deploy previews remain local-only; PR #102 stays connected.
const liveProduction = process.env.CONTEXT === "production";
const approvedPreview = process.env.CONTEXT === "deploy-preview" &&
  process.env.REVIEW_ID === "102";
const mode = liveProduction ? "live" : approvedPreview ? "connected" : "preview";

writeFileSync(
  "assets/js/studylab-admin-config.js",
  `window.StudyLabAdminConfig = Object.freeze(${JSON.stringify({ mode })});\n`,
);
console.log(`StudyLab Admin Dashboard: ${mode}`);
