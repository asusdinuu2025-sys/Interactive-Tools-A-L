# Applied migration source recovery

This recovery restores the SQL sources for nine already-applied migrations from the live project's `supabase_migrations.schema_migrations.statements` ledger. The statements are preserved for historical reproducibility.

## Account-specific migration

`20261102130653_grant_social_admin_to_requested_account.sql` is intentionally a no-op. The original applied SQL granted an admin role to one specific `auth.users` row. Its hard-coded account identifier is deliberately excluded from source control. Admin assignment is account provisioning, not reusable schema setup; perform it separately through a trusted admin process when setting up a new environment.

`20261102223934_study_room_session_credit_rollback_and_midnight_continuity.sql` is the correctly versioned source for the Study Room migration that was applied to production after the previous `20261102140000` filename proved older than the live migration ledger. The superseded `20261102140000` file was removed so the CLI will not try to replay it out of order.

## Important

- Do not edit these historical versions to represent new schema changes. Add a new timestamped migration instead.
- The live project already records these versions as applied. Restoring their files does not reapply them to production.
- The account-specific admin assignment is not automatically recreated in a fresh environment.
