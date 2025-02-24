import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get users with avatars ordered by most recent first
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, raw_user_meta_data')
      .order('created_at', { ascending: false })
      .limit(5)

    if (usersError) throw usersError

    // Get total count
    const { count, error: countError } = await supabaseClient
      .from('users')
      .select('id', { count: 'exact', head: true })

    if (countError) throw countError

    // Map users to get their metadata
    const recentUsers = users?.map(user => ({
      name: user.raw_user_meta_data?.name,
      picture: user.raw_user_meta_data?.avatar_url || user.raw_user_meta_data?.picture
    })) || []

    return new Response(
      JSON.stringify({
        recentUsers,
        totalCount: count || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})