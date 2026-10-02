import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client — uses SERVICE_ROLE_KEY
// NEVER import this in client components
export function createServerSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Verify the user's JWT from the Authorization header
// Returns { user, error }
export async function authenticateRequest(req) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid Authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { user: null, error: error?.message || 'Invalid token' }
  }

  return { user, error: null }
}
