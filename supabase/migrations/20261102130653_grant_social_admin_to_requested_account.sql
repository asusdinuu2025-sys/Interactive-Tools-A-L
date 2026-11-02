-- Recovered migration-history placeholder for an account-specific operation.
-- The original applied statement granted the admin app_metadata role to one
-- specific auth.users record. Its hard-coded account identifier is deliberately
-- not copied into source control. Account-level admin provisioning is an
-- operational task and must be performed through a trusted, reviewed process.
-- This no-op preserves the applied migration version without granting admin
-- access to an arbitrary account in a fresh environment.

SELECT 1;
