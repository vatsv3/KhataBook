import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

const URL_KEY = 'khatabook_supabase_url';
const ANON_KEY_KEY = 'khatabook_supabase_anon_key';

let supabaseInstance: SupabaseClient | null = null;

export const hasHardcodedConfig = (): boolean => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
};

export const isSupabaseConfigured = async (): Promise<boolean> => {
  if (hasHardcodedConfig()) {
    return true;
  }
  const url = await AsyncStorage.getItem(URL_KEY);
  const key = await AsyncStorage.getItem(ANON_KEY_KEY);
  return !!url && !!key;
};

export const getSupabaseConfig = async () => {
  if (hasHardcodedConfig()) {
    return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
  }
  const url = await AsyncStorage.getItem(URL_KEY);
  const key = await AsyncStorage.getItem(ANON_KEY_KEY);
  return { url, key };
};

export const initSupabase = async (url: string, key: string): Promise<boolean> => {
  try {
    if (!url || !key) return false;
    
    // Test URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('અયોગ્ય URL ફોર્મેટ');
    }

    const client = createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    supabaseInstance = client;
    
    // Save to AsyncStorage only if it's not already hardcoded
    if (!hasHardcodedConfig()) {
      await AsyncStorage.setItem(URL_KEY, url);
      await AsyncStorage.setItem(ANON_KEY_KEY, key);
    }
    return true;
  } catch (error) {
    console.error('Supabase initialization failed:', error);
    return false;
  }
};

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    throw new Error('Supabase client is not initialized yet.');
  }
  return supabaseInstance;
};

export const clearSupabaseConfig = async () => {
  supabaseInstance = null;
  if (!hasHardcodedConfig()) {
    await AsyncStorage.removeItem(URL_KEY);
    await AsyncStorage.removeItem(ANON_KEY_KEY);
  }
  // Clear user session token
  await AsyncStorage.removeItem('supabase.auth.token');
};

// Try to auto-initialize on startup if credentials exist
export const autoInitSupabase = async (): Promise<boolean> => {
  const { url, key } = await getSupabaseConfig();
  if (url && key) {
    return await initSupabase(url, key);
  }
  return false;
};
