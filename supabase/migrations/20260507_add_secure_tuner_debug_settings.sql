-- ============================================================================
-- VOICEVAULT TUNER DEBUG ACCESS - SECURE ADMIN SETTING
-- ============================================================================
-- Date: 2026-05-07
-- Purpose: Hide tuner debug reports unless an active admin enables them.
-- Security:
--   - Setting storage is not directly granted to client roles.
--   - Read access for the tuner returns true only when the caller is an active
--     admin and the setting is enabled.
--   - Write access is only through an admin-checked RPC.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_settings FROM anon, authenticated;

DROP POLICY IF EXISTS "Admins can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete app settings" ON public.app_settings;

CREATE POLICY "Admins can view app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.user_id = auth.uid()
      AND admins.is_active = true
  )
);

CREATE POLICY "Admins can insert app settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.user_id = auth.uid()
      AND admins.is_active = true
  )
);

CREATE POLICY "Admins can update app settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.user_id = auth.uid()
      AND admins.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.user_id = auth.uid()
      AND admins.is_active = true
  )
);

CREATE POLICY "Admins can delete app settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admins
    WHERE admins.user_id = auth.uid()
      AND admins.is_active = true
  )
);

INSERT INTO public.app_settings (key, value)
VALUES ('tuner_debug', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_tuner_debug_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
  caller_is_admin BOOLEAN;
  setting_enabled BOOLEAN;
BEGIN
  caller := auth.uid();

  IF caller IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = caller
      AND is_active = true
  ) INTO caller_is_admin;

  IF NOT caller_is_admin THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(value @> '{"enabled": true}'::jsonb, FALSE)
  INTO setting_enabled
  FROM public.app_settings
  WHERE key = 'tuner_debug';

  RETURN COALESCE(setting_enabled, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_tuner_debug_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
  caller_is_admin BOOLEAN;
  setting_enabled BOOLEAN;
BEGIN
  caller := auth.uid();

  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = caller
      AND is_active = true
  ) INTO caller_is_admin;

  IF caller IS NULL OR NOT caller_is_admin THEN
    RAISE EXCEPTION 'Access denied. Active admin privileges required.';
  END IF;

  SELECT COALESCE(value @> '{"enabled": true}'::jsonb, FALSE)
  INTO setting_enabled
  FROM public.app_settings
  WHERE key = 'tuner_debug';

  RETURN COALESCE(setting_enabled, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tuner_debug_enabled(p_enabled BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID;
  caller_is_admin BOOLEAN;
  next_enabled BOOLEAN;
BEGIN
  caller := auth.uid();
  next_enabled := COALESCE(p_enabled, FALSE);

  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = caller
      AND is_active = true
  ) INTO caller_is_admin;

  IF caller IS NULL OR NOT caller_is_admin THEN
    RAISE EXCEPTION 'Access denied. Active admin privileges required.';
  END IF;

  INSERT INTO public.app_settings (key, value, updated_at, updated_by)
  VALUES (
    'tuner_debug',
    jsonb_build_object('enabled', next_enabled),
    NOW(),
    caller
  )
  ON CONFLICT (key) DO UPDATE
  SET
    value = jsonb_build_object('enabled', next_enabled),
    updated_at = NOW(),
    updated_by = caller;

  RETURN next_enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tuner_debug_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_tuner_debug_enabled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_tuner_debug_enabled(BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_tuner_debug_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_tuner_debug_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tuner_debug_enabled(BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.get_tuner_debug_access() IS
'Returns true only when the caller is an active admin and tuner debug is enabled.';

COMMENT ON FUNCTION public.admin_get_tuner_debug_enabled() IS
'Returns tuner debug setting for active admins only.';

COMMENT ON FUNCTION public.admin_set_tuner_debug_enabled(BOOLEAN) IS
'Allows active admins to enable or disable tuner debug reports.';
