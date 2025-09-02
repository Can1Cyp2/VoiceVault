Admin SQL helpers
-----------------

This folder contains SQL helpers for admin functionality used by the app.

Deploying admin_get_stats.sql

1. From your local machine with psql configured against the project database:

   psql "postgresql://<user>:<pass>@<host>:<port>/<db>" -f supabase/sql/admin_get_stats.sql

2. Or use the Supabase CLI:

   supabase db remote set <db-connection-string>
   supabase db query < supabase/sql/admin_get_stats.sql

Note: The function uses SECURITY DEFINER — ensure the function owner is a
trusted role. Adjust GRANTs as needed. The function expects an existing
`check_user_admin_status(uuid)` RPC that returns `is_admin`.
