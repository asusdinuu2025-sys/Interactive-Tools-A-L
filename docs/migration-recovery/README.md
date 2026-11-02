# Applied migration source recovery

This recovery restores the SQL sources for nine already-applied migrations from the live project's `supabase_migrations.schema_migrations.statements` ledger. The statements are preserved for historical reproducibility.

## Account-specific migration

`20261102130653_grant_social_admin_to_requested_account.sql` is intentionally a no-op. The original applied SQL granted an admin role to one specific `auth.users` row. Its hard-coded account identifier is deliberately excluded from source control. Admin assignment is account provisioning, not reusable schema setup; perform it separately through a trusted admin process when setting up a new environment.

## Important

- Do not edit these historical versions to represent new schema changes. Add a new timestamped migration instead.
- The live project already records these versions as applied. Restoring their files does not reapply them to production.
- The account-specific admin assignment is not automatically recreated in a fresh environment.
