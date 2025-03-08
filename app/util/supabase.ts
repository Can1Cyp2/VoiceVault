// app/util/supabase.ts
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../env';

console.log('Using SUPABASE_URL:', SUPABASE_URL);
console.log('Using SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set to a value' : 'Not Set');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase URL or Anon Key is missing: ' + SUPABASE_URL);
}

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth State Changed:', event, session);
});

async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    console.log('Supabase Connection Test:', data, error);
  } catch (err) {
    console.error('Supabase Connection Error:', err);
  }
}
testSupabaseConnection();