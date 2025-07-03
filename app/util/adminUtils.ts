// utils/adminUtils.js
import { useState, useEffect } from 'react';
import { supabase } from "./supabase";





// Combined function for efficiency
export const checkAdminStatus = async () => {
  try {
    const user = supabase.auth.user();

    if (!user) {
      console.log('No user found');
      return { isAdmin: false, adminDetails: null };
    }

    console.log('Checking admin status for user:', user.id);

    const { data, error } = await supabase.rpc('check_user_admin_status', {
      check_user_id: user.id,
    });

    if (error) {
      console.error('Error checking admin status via RPC:', error);
      return { isAdmin: false, adminDetails: null };
    }

    // The function is expected to return a record { is_admin: boolean }
    // As it's a table function, it will be an array
    const isAdmin = data?.[0]?.is_admin ?? false;
    const adminDetails = data?.[0] ?? null;

    if (isAdmin) {
      console.log('Admin data found:', adminDetails);
      return { isAdmin: true, adminDetails };
    }

    console.log('User is not an admin.');
    return { isAdmin: false, adminDetails: null };
  } catch (error) {
    console.error('Error in checkAdminStatus:', error);
    return { isAdmin: false, adminDetails: null };
  }
};

// React Hook for admin status
export const useAdminStatus = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminDetails, setAdminDetails] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      setLoading(true);
      try {
        const { isAdmin: adminStatus, adminDetails: details } = await checkAdminStatus();
        setIsAdmin(adminStatus);
        setAdminDetails(details);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setAdminDetails(null);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();

    // Listen for auth changes (v1 syntax)
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        await checkAdmin();
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  return { isAdmin, loading, adminDetails };
};