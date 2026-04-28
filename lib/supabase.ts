import { createClient } from "@supabase/supabase-js";

let supabaseClient: any = null;

export function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      console.warn("Supabase credentials missing: URL?", !!url, "KEY?", !!key);
      return null;
    }

    if (url.includes(key) || url.length > 100) {
      console.error("CRITICAL: SUPABASE_URL seems to contain the API Key or is malformed. Please check your Secrets.");
      return null;
    }
    
    try {
      supabaseClient = createClient(url, key);
      console.log("Supabase client initialized successfully");
    } catch (error) {
      console.error("Error creating Supabase client:", error);
      return null;
    }
  }
  return supabaseClient;
}
