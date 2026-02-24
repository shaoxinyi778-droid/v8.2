import { createClient } from '@supabase/supabase-js';

// Access environment variables using Vite's import.meta.env
// Cast to any to avoid TypeScript error: Property 'env' does not exist on type 'ImportMeta'
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Debug log to check if env vars are loaded (visible in browser console)
console.log('Supabase Config Status:', {
  hasUrl: !!SUPABASE_URL,
  hasKey: !!SUPABASE_ANON_KEY,
  mode: (import.meta as any).env.MODE
});

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase configuration is missing. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.');
}

// Fallback to empty strings to prevent crash on load, but requests will fail if env vars are missing
export const supabase = createClient(
  SUPABASE_URL || '', 
  SUPABASE_ANON_KEY || ''
);