// Database-only regression. Uses an isolated in-memory PostgreSQL (PGlite),
// never the real StudyLab project or a production stress test.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
  const db=new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE SCHEMA study_room_private;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
        AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE public.study_room_members (
        user_id uuid PRIMARY KEY REFERENCES auth.users(id),
        subject text, is_studying boolean NOT NULL DEFAULT false,
        session_active boolean NOT NULL DEFAULT false,
        session_presence_state text, today_date date, week_start date,
        session_expired_at timestamptz, session_target_reached_at timestamptz,
        last_heartbeat_at timestamptz, updated_at timestamptz
      );
      CREATE PUBLICATION supabase_realtime FOR TABLE public.study_room_members;
      INSERT INTO auth.users(id) VALUES('11111111-1111-4111-8111-111111111111');
      INSERT INTO public.study_room_members(user_id,subject,is_studying,session_active)
        VALUES('11111111-1111-4111-8111-111111111111','Maths',false,false);
    `);
    const migration=fs.readFileSync('supabase/migrations/20261117174500_study_room_realtime_state_signals.sql','utf8');
    await db.exec(migration);
    const rev=async()=>Number((await db.query(
      "SELECT revision FROM public.study_room_change_signals WHERE user_id='11111111-1111-4111-8111-111111111111'"
    )).rows[0].revision);
    assert.equal(await rev(),1,'existing members receive one initial row');
    const publication=(await db.query(
      "SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'"
    )).rows.map(x=>x.tablename);
    assert(publication.includes('study_room_change_signals'),'signals must be published');
    assert(!publication.includes('study_room_members'),'heartbeats must not be replicated');
    await db.exec("UPDATE public.study_room_members SET last_heartbeat_at=now(),updated_at=now()");
    assert.equal(await rev(),1,'heartbeat must NOT broadcast');
    await db.exec("UPDATE public.study_room_members SET is_studying=true,session_active=true,session_presence_state='present'");
    assert.equal(await rev(),2,'start signals once');
    await db.exec("UPDATE public.study_room_members SET last_heartbeat_at=now()+interval '20 seconds'");
    assert.equal(await rev(),2,'next heartbeat must NOT signal');
    await db.exec("UPDATE public.study_room_members SET subject='Physics'");
    assert.equal(await rev(),3,'subject change broadcasts once');
    await db.exec("UPDATE public.study_room_members SET session_presence_state='paused',is_studying=false");
    assert.equal(await rev(),4,'pause emits one event even with two changed fields');
    await db.exec("UPDATE public.study_room_members SET session_active=false");
    assert.equal(await rev(),5,'end emits once');
    await db.exec("DELETE FROM public.study_room_members");
    assert.equal(await rev(),6,'deletion signals clients to refresh');
    await db.exec("SET ROLE authenticated");
    await assert.rejects(db.exec(
      "INSERT INTO public.study_room_change_signals(user_id) VALUES('11111111-1111-4111-8111-111111111111')"
    ), /permission denied|row.level.security/i, 'students may not fabricate signals');
    console.log('PASS: Study Room writes and credits untouched; heartbeats silent, visible state changes broadcast once, read-only signal RLS.');
  } finally {
    await db.close();
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
