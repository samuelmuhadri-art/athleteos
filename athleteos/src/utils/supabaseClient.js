// @ts-check
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** @type {import('@supabase/supabase-js').SupabaseClient<import('../types/database.types').Database>} */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
