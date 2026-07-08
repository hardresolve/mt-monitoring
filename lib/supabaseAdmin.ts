// SERVER-ONLY. Never import this file from a client component.
// Uses the service role key to perform privileged operations
// (updating emails, resetting passwords) via the Supabase Admin API.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Adjust this env var name if yours is different in Vercel settings.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})