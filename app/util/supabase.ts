// File location: app/util/supabase.ts

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Supabase API keys and URL
const SUPABASE_URL = "https://ydxbhxstbspjpncpsmrz.supabase.co"; // Supabase project URL
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkeGJoeHN0YnNwanBuY3BzbXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNDY1MjUsImV4cCI6MjA1MjcyMjUyNX0.XxXdNC9oDkGvJnRN445IPXyHsNlrGCsaFFkgqpS0eNM"; // anon public key

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true, // Automatically refresh tokens
    persistSession: true, // Store session in AsyncStorage
    storage: AsyncStorage, // Use AsyncStorage for persistence
  },
});
