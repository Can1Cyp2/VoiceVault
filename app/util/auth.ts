// app/util/auth.ts
import { supabase } from './supabase';

export const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data.session; // Session is persisted by SecureStore automatically
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Logout error:', error.message);
};