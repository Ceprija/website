import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "astro:env/server";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean((SUPABASE_URL ?? "").trim() && (SUPABASE_SERVICE_ROLE_KEY ?? "").trim());
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL!.trim(), SUPABASE_SERVICE_ROLE_KEY!.trim(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
