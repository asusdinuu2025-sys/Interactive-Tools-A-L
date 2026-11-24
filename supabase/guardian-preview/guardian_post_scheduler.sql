-- STAGED ONLY. Requires a deployed worker with verify_jwt=false and a strong
-- dedicated token set in its Edge secrets AND Vault under guardian_post_worker_token.
-- Never use a service-role key as the worker token or put token values in Git.
-- Schedule only in a non-production environment first; check invocation quotas.
-- The watchdog must be running and verified before the worker is allowed to report healthy.
select cron.schedule('studylab-guardian-post-watchdog','2 seconds',$job$
 select studylab_private.guardian_post_expire();
$job$);
select cron.schedule('studylab-guardian-post-worker','3 seconds',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='guardian_post_project_url')||'/functions/v1/studylab-guardian-post-worker',
  headers:=jsonb_build_object('Content-Type','application/json','x-guardian-worker',(select decrypted_secret from vault.decrypted_secrets where name='guardian_post_worker_token')),
  body:='{}'::jsonb,timeout_milliseconds:=7000)
 where exists(select 1 from studylab_private.guardian_post_jobs)
 or exists(select 1 from studylab_private.guardian_chat_preferences where singleton and mode='public');
$job$);
-- Bootstrap one authenticated synthetic worker invocation ONLY after confirming both
-- schedules run. The third mode stays unavailable until health is fresh.
