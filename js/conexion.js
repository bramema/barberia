const { createClient } = supabase;

const SUPABASE_URL = "https://wakzdxcnrbplyqiggtak.supabase.co";
const SUPABASE_KEY = "sb_publishable_jXiisq2FbBwJU8u3R-tMDg_abyvHrGZ";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);