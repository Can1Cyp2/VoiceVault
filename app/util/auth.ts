// app/util/auth.ts
import { supabase } from './supabase';

// Function to check if the user is logged in
export const login = async (email: string, password: string) => {
  const { user, session, error } = await supabase.auth.signIn({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return session; // Session is persisted by SecureStore automatically
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Logout error:', error.message);
};