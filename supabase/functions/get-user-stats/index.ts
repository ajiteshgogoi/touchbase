import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

function addCorsHeaders(headers: Headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: addCorsHeaders() });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get users ordered by most recent first
    const { data: { users }, error: usersError } = await supabaseClient.auth.admin.listUsers({
      perPage: 5,
      page: 1,
      sortBy: {
        column: 'created_at',
        order: 'desc'
      }
    });

    if (usersError) throw usersError;

    // Map users to get their metadata
    const recentUsers = users.map(user => ({
      name: user.user_metadata?.name,
      picture: user.user_metadata?.avatar_url || user.user_metadata?.picture
    }));

    // Get total count
    const { data: { total }, error: countError } = await supabaseClient.auth.admin.listUsers({
      perPage: 1,
      page: 1
    });

    if (countError) throw countError;

    // Return the response with CORS headers
    return new Response(
      JSON.stringify({
        recentUsers,
        totalCount: total || 0
      }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error.message)
    
    // Return error response with CORS headers
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: addCorsHeaders(new Headers({ 'Content-Type': 'application/json' })),
        status: 500,
      }
    )
  }
})