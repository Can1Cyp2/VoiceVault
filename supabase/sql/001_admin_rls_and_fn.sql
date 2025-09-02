-- 001_admin_rls_and_fn.sql
--
-- Adds a helper function to check admin membership and a safe RLS policy
-- for the `profiles` table so admins can SELECT rows for admin tasks.
-- Run this in the Supabase SQL editor as a project owner.
-- IMPORTANT: review and adapt to your DB schema (table names, admin table, role column).

-- NOTE: Run as the database OWNER (or a role with CREATE FUNCTION privileges). The
-- function is SECURITY DEFINER and should be owned by a trusted DB role. Adjust
-- table names and schema as needed for your project.

-- 1) Create a safe helper function that checks whether a given user_id is an admin.
--    This function is SECURITY DEFINER and owned by a privileged role (the function owner)
--    so that it can be used inside RLS policies without requiring the calling user
--    to have read access to the admins table.

create or replace function public.is_user_admin(p_uid uuid)
returns boolean
language plpgsql
security definer
as $$
BEGIN
  -- First check an explicit admins table if present
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'admins' AND relnamespace = 'public'::regnamespace) THEN
    RETURN EXISTS(SELECT 1 FROM public.admins a WHERE a.user_id = p_uid);
  END IF;

  -- If there's no admins table, fall back to checking a role column on profiles, but
  -- only if the profiles table exists in public schema.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    RETURN EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = p_uid AND coalesce(p.role, '') = 'admin');
  END IF;

  -- Default: not an admin
  RETURN FALSE;
END;
$$;

-- NOTE: After creating a SECURITY DEFINER function, ensure the function owner is a secure
-- database role (e.g. the default postgres/supabase_admin) and not a user account.
-- You can change owner with: ALTER FUNCTION public.is_user_admin(uuid) OWNER TO postgres;

-- 2) Enable RLS on profiles and add policies, but only if the profiles table exists.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    -- Remove existing policy if present then create policy allowing admins to SELECT any profile
    DROP POLICY IF EXISTS "allow_admins_select_profiles" ON public.profiles;
    CREATE POLICY "allow_admins_select_profiles"
      ON public.profiles
      FOR SELECT
      USING ( public.is_user_admin(auth.uid()::uuid) );

    -- Optional: keep an existing policy that allows users to select their own row
    DROP POLICY IF EXISTS "allow_owner_select_own_profile" ON public.profiles;
    CREATE POLICY "allow_owner_select_own_profile"
      ON public.profiles
      FOR SELECT
      USING ( auth.uid()::uuid = id );
  END IF;
END
$$;

-- Important: Do not make policies overly permissive. Test carefully in a staging DB.

-- 3) Quick validation helper (non-destructive): show current policies (only if table exists)
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    RAISE NOTICE 'Current policies for public.profiles:';
    PERFORM (
      SELECT json_agg(row_to_json(t))
      FROM (
        select policyname, permissive, roles, qual, with_check from pg_policies where tablename = 'profiles'
      ) t
    );
  ELSE
    RAISE NOTICE 'Table public.profiles does not exist; skipped policy listing.';
  END IF;
END
$$;
