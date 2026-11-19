/* StudyLab Admin mode: resolved from the actual trusted site hostname.
   This file is also the safe fallback if Netlify skips its build generator.
   Client mode never grants authorization; Supabase RPCs and RLS enforce it. */
(function () {
  "use strict";
  const host=String(window.location.hostname||"").toLowerCase();
  const match=/^deploy-preview-([0-9]+)--studylablk\.netlify\.app$/.exec(host);
  const reviewId=match?match[1]:null;
  const approved=["102","110","114","115"];
  const mode=host==="studylablk.netlify.app"?"live":
    reviewId&&approved.includes(reviewId)?"connected":"preview";
  window.StudyLabAdminConfig=Object.freeze({mode,reviewId});
})();
