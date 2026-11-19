import { readFileSync, writeFileSync } from "node:fs";

// Always publish the exact same host-verified Admin configuration. Netlify's
// build CONTEXT/REVIEW_ID can be absent on skipped, locked, or cached builds.
// The trusted hostname and existing server-side Admin RPC controls decide
// which deployment can publish real StudyLab content.
const source=readFileSync(new URL("../assets/js/studylab-admin-config.js",import.meta.url),"utf8");
writeFileSync("assets/js/studylab-admin-config.js",source);
console.log("StudyLab Admin: host-verified runtime mode (production live, approved previews connected)");
