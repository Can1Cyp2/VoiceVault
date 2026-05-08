import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { setPitchDebugCollectionEnabled } from "./pitchDebug";

type BooleanRpcPayload =
  | boolean
  | null
  | undefined
  | Record<string, unknown>
  | Array<boolean | Record<string, unknown>>;

const readBooleanRpcPayload = (
  payload: BooleanRpcPayload,
  functionName: string
): boolean => {
  if (typeof payload === "boolean") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return readBooleanRpcPayload(payload[0], functionName);
  }

  if (payload && typeof payload === "object") {
    const namedValue = payload[functionName];
    if (typeof namedValue === "boolean") {
      return namedValue;
    }

    const enabledValue = payload.enabled;
    if (typeof enabledValue === "boolean") {
      return enabledValue;
    }
  }

  return false;
};

export const fetchTunerDebugAccess = async (): Promise<boolean> => {
  const user = supabase.auth.user();

  if (!user) {
    return false;
  }

  try {
    const { data, error } = await supabase.rpc("get_tuner_debug_access");

    if (error) {
      return false;
    }

    return readBooleanRpcPayload(data as BooleanRpcPayload, "get_tuner_debug_access");
  } catch {
    return false;
  }
};

export const fetchAdminTunerDebugEnabled = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc("admin_get_tuner_debug_enabled");

  if (error) {
    throw error;
  }

  return readBooleanRpcPayload(
    data as BooleanRpcPayload,
    "admin_get_tuner_debug_enabled"
  );
};

export const setAdminTunerDebugEnabled = async (
  enabled: boolean
): Promise<boolean> => {
  const { data, error } = await supabase.rpc("admin_set_tuner_debug_enabled", {
    p_enabled: enabled,
  });

  if (error) {
    throw error;
  }

  return readBooleanRpcPayload(
    data as BooleanRpcPayload,
    "admin_set_tuner_debug_enabled"
  );
};

export const useTunerDebugAccess = () => {
  const [canViewDebug, setCanViewDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const applyAccess = useCallback((enabled: boolean) => {
    setCanViewDebug(enabled);
    setPitchDebugCollectionEnabled(enabled);
  }, []);

  const refresh = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
    }

    try {
      const enabled = await fetchTunerDebugAccess();
      if (mountedRef.current) {
        applyAccess(enabled);
      }
      return enabled;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [applyAccess]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const { data: subscription } = supabase.auth.onAuthStateChange(async () => {
      await refresh();
    });

    return () => {
      mountedRef.current = false;
      subscription?.unsubscribe();
      setPitchDebugCollectionEnabled(false);
    };
  }, [refresh]);

  return { canViewDebug, loading, refresh };
};
