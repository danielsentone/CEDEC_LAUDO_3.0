import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://obwbrdjoncrnyjfckrfj.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-9EpdsRAeVNssXnOxvmNRQ_jxqFfl6b';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);