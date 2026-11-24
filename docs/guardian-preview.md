# StudyLab Guardian preview

- Bot Management is a new admin dashboard tab. Preview settings are isolated in localStorage, never applied to production. Live RPC requires the existing server-verified admin role.
- The staged SQL adds default-off deterministic protection for chat, posts and comments. It rejects suspicious URL structures and excessive recent submissions; it does not verify URL reputation, identify AI harms or remove existing content. Rate limiting is based on retained rows and is not a durable anti-abuse quota. Rejected transactions do not retain an audit event. Test database behavior before enabling.
- The optional Edge Function is an admin-only text classification sandbox. Set STUDYLAB_GUARDIAN_OPENAI_KEY as an Edge Function secret in the test environment; never commit it. Only fictional text should be tested. No real students' content is transmitted. No image uploads are accepted. Image moderation requires a safe child-safety workflow, quarantine, access controls, and dedicated handling of suspected illegal imagery before rollout.
- Run node scripts/studylab-guardian-tests.cjs. On a separate Supabase database, apply staged migration and test admin/non-admin authorization, defaults, direct insert/edit, disabled modules, rate limits, existing RLS, uploads, retention, UI error handling and rollback. Do not deploy or merge until verified.
- Before live AI enforcement, implement privacy notice, retention policy, a review queue, authenticated server-only publishing, per-user quotas, and language-specific evaluation. Do not auto-ban users based on model output.

## Production-host test mode
The Bot Management UI now works on the production hostname without the staged database migration. Its switches are local simulations only, and the admin-only Edge Function handles fictional text tests. No live enforcement is enabled. Do not apply the staged SQL or activate automatic moderation before isolated database testing.
