import {
  createClient as createSupabaseClient,
  type SupabaseClient
} from "@supabase/supabase-js";

import type { Database } from "./database.types";

export function createClient(url: string, anonKey: string): SupabaseClient<Database> {
  return createSupabaseClient<Database>(url, anonKey);
}