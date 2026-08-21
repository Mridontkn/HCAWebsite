const SUPABASE_URL = "https://sheaqyejsvivslnmfiki.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_nOVyivEjvpN2hTbXxeLKrA_Pkc2cMBk";

const hcaSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Make the same client available to both the existing public-site scripts
// and the admin panel.
window.hcaSupabase = hcaSupabase;

console.log("Supabase client initialized:", !!window.hcaSupabase);
