
// File location: app/util/supabase.ts

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../supabaseConfig';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);