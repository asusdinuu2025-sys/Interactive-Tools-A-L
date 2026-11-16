import { writeFileSync } from "node:fs";

// Production admin publishing is opt-in. Only PR #102's explicitly approved
// admin preview may connect to real Supabase admin functions before merge.
// All other branch deploys remain sandboxed on this device.
const liveProduction = process.env.CONTEXT === "production" &&
  process.env.STUDYLAB_ADMIN_LIVE === "true";
const approvedPreview = process.env.CONTEXT === "deploy-preview" &&
  process.env.REVIEW_ID === "102";
const mode = liveProduction ? "live" : approvedPreview ? "connected" : "preview";

writeFileSync(
  "assets/js/studylab-admin-config.js",
  `window.StudyLabAdminConfig = Object.freeze(${JSON.stringify({ mode })});\n`,
);
console.log(`StudyLab Admin Dashboard: ${mode}`);
