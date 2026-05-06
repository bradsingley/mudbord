/**
 * Supabase Configuration
 * Initializes the Supabase client
 */

const SUPABASE_URL = 'https://whcfyfyqhlwqyoqdhuls.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pOYW0_Fgidv3pWqxIed3Yw_eH3QB2XQ';

// Get createClient from global supabase object (CDN approach)
const { createClient } = supabase;

// Initialize the Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Storage bucket name
const STORAGE_BUCKET = 'moodboard-images';

// Table names
const TABLES = {
    PROFILES: 'moodboard_profiles',
    BOARDS: 'moodboard_boards',
    IMAGES: 'moodboard_images'
};
