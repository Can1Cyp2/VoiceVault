// app/util/supabase.ts
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants'; // Ensure this is imported

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || Constants.expoConfig?.extra?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || '';

console.log('Using SUPABASE_URL:', SUPABASE_URL);
console.log('Using SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set to a value' : 'Not Set');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase URL or Anon Key is missing: ' + SUPABASE_URL);
}

// a wrapper for expo-secure-store to match Supabase's SupportedStorage interface
const secureStorage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error getting item from SecureStore:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error setting item in SecureStore:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing item from SecureStore:', error);
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true, // Automatically refresh tokens
    persistSession: true, // Persist session across app restarts
    detectSessionInUrl: false, // Disable for native apps (adjust if using web auth)
  },
});

// Optional: Helper to get the current session
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) console.error('Error getting session:', error.message);
  return data?.session;
};

// Keep the connection test
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    console.log('Supabase Connection Test:', data, error);
  } catch (err) {
    console.error('Supabase Connection Error:', err);
  }
}
testSupabaseConnection();