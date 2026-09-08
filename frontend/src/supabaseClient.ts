import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Fallback warning in console if keys are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please configure them in your frontend/.env file.'
  );
}

// Keep the sign-in surface renderable when this checkout has not been configured.
// App and Login prevent authentication requests until real configuration exists.
export const supabase = createClient(supabaseUrl || 'https://unconfigured.invalid', supabaseAnonKey || 'unconfigured');
