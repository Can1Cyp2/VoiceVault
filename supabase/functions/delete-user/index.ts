// /// <reference lib="deno.ns" />

// import "jsr:@supabase/functions-js/edge-runtime.d.ts"; // Supabase Edge Functions runtime
// import { createClient } from "jsr:@supabase/supabase-js@2";

// // Get Supabase URL and Service Role Key from environment variables
// const SUPABASE_URL = Deno.env.get("https://ydxbhxstbspjpncpsmrz.supabase.co")!;
// const SERVICE_ROLE_KEY = Deno.env.get(
//   "..kjk--"
// )!; // Secure Admin Key

// // Create Supabase client with admin privileges
// const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
//   auth: { autoRefreshToken: false, persistSession: false },
// });

// Deno.serve(async (req) => {
//   if (req.method !== "POST") {
//     return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
//       status: 405,
//       headers: { "Content-Type": "application/json" },
//     });
//   }

//   try {
//     const { user_id } = await req.json();

//     if (!user_id) {
//       return new Response(JSON.stringify({ error: "User ID is required" }), {
//         status: 400,
//         headers: { "Content-Type": "application/json" },
//       });
//     }

//     // Step 1: Delete user-related data from tables before account deletion
//     await supabase.from("issues").delete().eq("user_id", user_id);
//     await supabase.from("saved_lists").delete().eq("user_id", user_id);
//     await supabase.from("songs").delete().eq("user_id", user_id);

//     // Step 2: Delete user account from Supabase Auth
//     const { error } = await supabase.auth.admin.deleteUser(user_id);

//     if (error) {
//       return new Response(
//         JSON.stringify({ error: error.message || "Failed to delete user" }),
//         { status: 500, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     return new Response(
//       JSON.stringify({ success: "User deleted successfully" }),
//       { status: 200, headers: { "Content-Type": "application/json" } }
//     );
//   } catch (error) {
//     return new Response(JSON.stringify({ error: "Internal Server Error" }), {
//       status: 500,
//       headers: { "Content-Type": "application/json" },
//     });
//   }
// });
