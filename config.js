// config.js
const SUPABASE_URL = 'https://ewnbqmfcfcywhhdscubf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hQEiXXFGc0iyg6R69VJh3A_3wf4kiTB';

// СОЗДАЁМ КЛИЕНТ ЗДЕСЬ (один раз)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);