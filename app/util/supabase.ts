// app/util/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

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
  localStorage: secureStorage, // had to downgrade: In v1, use `localStorage` instead of `auth.storage`
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
});


export const getSession = async () => {
  try {
    const session = supabase.auth.session();
    if (!session) throw new Error('No session found.');
    return { session, error: null };
  } catch (error: any) {
    console.error('Error getting session:', error.message || error);
    return { session: null, error };
  }
};