-- 002_admin_get_stats.sql
--
-- Creates a SECURITY DEFINER RPC function `admin_get_stats` that returns
-- aggregate stats admins can call without requiring broad table access.
-- Run this as the DB owner in Supabase SQL editor.

create or replace function public.admin_get_stats()
returns table(total_users bigint, new_today bigint)
language plpgsql
security definer
as $$
begin
  -- If profiles exists use it, otherwise fall back to auth.users (Supabase auth schema).
  if to_regclass('public.profiles') is not null then
    -- Total users from public.profiles
    select count(*)::bigint into total_users from public.profiles;

    -- New users today (UTC) from public.profiles
    perform set_config('time_zone', 'UTC', true);
    select count(*)::bigint into new_today
    from public.profiles
    where created_at >= date_trunc('day', now() at time zone 'utc')
      and created_at < date_trunc('day', now() at time zone 'utc') + interval '1 day';

    return query select total_users, new_today;

  elsif to_regclass('auth.users') is not null then
    -- Total users from auth.users
    select count(*)::bigint into total_users from auth.users;

    -- New users today (UTC) from auth.users
    perform set_config('time_zone', 'UTC', true);
    select count(*)::bigint into new_today
    from auth.users
    where created_at >= date_trunc('day', now() at time zone 'utc')
      and created_at < date_trunc('day', now() at time zone 'utc') + interval '1 day';

    return query select total_users, new_today;

  else
    -- Neither table exists; return sensible defaults instead of erroring.
    return query select 0::bigint, 0::bigint;
  end if;

end;
$$;

-- You may want to set the function owner to a secure role, e.g. postgres:
-- alter function public.admin_get_stats() owner to postgres;

-- Grant execute to authenticated users only if you want admins to call it from client
-- but check RLS and auth.uid() checks as needed. Example: grant execute on function public.admin_get_stats() to authenticated;
