import { createClient } from '@supabase/supabase-js'

const RAW_URL = import.meta.env.VITE_SUPABASE_URL    || ''
const RAW_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const PLACEHOLDER_URLS = [
  'https://your-project.supabase.co',
  'your-project.supabase.co',
  '',
]

const PLACEHOLDER_KEYS = [
  'your-anon-key',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your',
  '',
]

export const ENV_OK =
  !PLACEHOLDER_URLS.includes(RAW_URL) &&
  !PLACEHOLDER_KEYS.includes(RAW_KEY) &&
  RAW_URL.startsWith('https://') &&
  RAW_URL.includes('.supabase.co') &&
  RAW_KEY.startsWith('eyJ')

const SUPA_URL = ENV_OK ? RAW_URL : 'https://placeholder.supabase.co'
const SUPA_KEY = ENV_OK ? RAW_KEY : 'eyJplaceholder'

export const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    persistSession:      true,
    autoRefreshToken:    true,
    detectSessionInUrl:  true,
  },
})

export async function q(fn) {
  if (!ENV_OK) return { data: null, error: { message: 'Supabase not configured.' } }
  try {
    const result = await fn()
    if (result?.error) console.error('[Supabase]', result.error.code, result.error.message)
    return result ?? { data: null, error: { message: 'No response' } }
  } catch (err) {
    console.error('[Supabase network]', err)
    return { data: null, error: { message: err?.message || 'Network error' } }
  }
}
