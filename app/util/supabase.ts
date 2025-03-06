// File location: app/util/supabase.ts
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Try local config, fall back to EAS env vars:
let SUPABASE_URL, SUPABASE_ANON_KEY;
try {
  const config = require('../../supabaseConfig');
  SUPABASE_URL = config.SUPABASE_URL;
  SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
} catch (error) {
  SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.SUPABASE_URL || '';
  SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || '';
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase URL and Anon Key must be provided');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);