import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://obwbrdjoncrnyjfckrfj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9EpdsRAeVNssXnOxvmNRQ_jxqFfl6b';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);