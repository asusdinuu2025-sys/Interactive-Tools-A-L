-- Run only after the worker and runtime migration are installed.
-- Independent watchdog, no idle writes or HTTP calls in private/strict modes.
select cron.schedule('studylab-guardian-post-watchdog','2 seconds',$job$
 select studylab_private.guardian_post_expire()
 where exists(select 1 from studylab_private.guardian_post_jobs)
 or exists(select 1 from studylab_private.guardian_chat_preferences where singleton and mode='public');
$job$);
select cron.schedule('studylab-guardian-post-worker','3 seconds',$job$
 select studylab_private.guardian_post_dispatch();
$job$);
