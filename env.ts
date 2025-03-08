// env.ts
import Constants from 'expo-constants';

export const SUPABASE_URL = Constants.expoConfig?.extra?.SUPABASE_URL || process.env.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials are missing. Using empty values.');
}