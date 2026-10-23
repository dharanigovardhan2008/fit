import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error(
    "Supabase is not configured. Create a .env file in the project root with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart npm run dev.",
  );
}

// The anon key is public by design. Row level security (database/migrations/0007) is what protects the data.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE keeps OAuth tokens out of the URL hash, which the app's HashRouter uses for routing.
    flowType: "pkce",
  },
});
