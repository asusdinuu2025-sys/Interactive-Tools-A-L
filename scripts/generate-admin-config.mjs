import { writeFileSync } from "node:fs";

// Only owner-approved Netlify deploy previews use real Supabase admin actions.
// This client mode does not grant admin rights: server-side RPCs and Storage RLS
// still check the signed-in admin account for every privileged operation.
// Owner-approved previews: #102, #110 and #114. Other previews and branch
// deploys remain isolated, so an unreviewed branch cannot change live data.
const liveProduction = process.env.CONTEXT === "production";
const reviewId = process.env.CONTEXT === "deploy-preview" &&
  /^\d+$/.test(process.env.REVIEW_ID || "") ? process.env.REVIEW_ID : null;
const approvedPreview = ["102", "110", "114"].includes(reviewId);
const mode = liveProduction ? "live" : approvedPreview ? "connected" : "preview";

writeFileSync(
  "assets/js/studylab-admin-config.js",
  `window.StudyLabAdminConfig = Object.freeze(${JSON.stringify({ mode, reviewId })});\n`,
);
console.log(`StudyLab Admin Dashboard: ${mode}`);
