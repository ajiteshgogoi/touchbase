// Follow this setup guide to integrate the Deno runtime into your project:
// https://deno.land/manual/getting_started/setup_your_environment

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as axiod from "https://deno.land/x/axiod/mod.ts";

const GROQ_API_URL = 'https://api.groq.com/v1/chat/completions';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get all contacts that need attention
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        last_contacted,
        preferred_contact_method,
        relationship_level,
        interactions (
          type,
          date,
          sentiment
        )
      `)
      .or('next_contact_due.is.null,next_contact_due.lte.now()');

    if (contactsError) throw contactsError;

    // Process each contact
    for (const contact of contacts) {
      // Generate AI suggestions using Groq
      const groqResponse = await axiod.default.post(
        GROQ_API_URL,
        {
          model: 'mixtral-8x7b-32768',
          messages: [
            {
              role: 'system',
              content: 'You are a relationship manager assistant helping users maintain meaningful connections.'
            },
            {
              role: 'user',
              content: `Generate personalized interaction suggestions for this contact:
                Name: ${contact.name}
                Last contacted: ${contact.last_contacted || 'Never'}
                Preferred method: ${contact.preferred_contact_method || 'Not specified'}
                Relationship level: ${contact.relationship_level}/5
                Recent interactions: ${contact.interactions.map(i => 
                  `${i.type} (${i.sentiment || 'neutral'})`
                ).join(', ')}
              `
            }
          ],
          temperature: 0.7,
          max_tokens: 250
        },
        {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const suggestions = groqResponse.data.choices[0].message.content;

      // Calculate next contact due date based on relationship level
      const daysUntilNext = {
        1: 90, // Every 3 months
        2: 60, // Every 2 months
        3: 30, // Monthly
        4: 14, // Every 2 weeks
        5: 7,  // Weekly
      }[contact.relationship_level] || 30;

      const nextContactDue = new Date();
      nextContactDue.setDate(nextContactDue.getDate() + daysUntilNext);

      // Update contact with next due date and create reminder
      await supabaseClient.from('contacts').update({
        next_contact_due: nextContactDue.toISOString()
      }).eq('id', contact.id);

      await supabaseClient.from('reminders').insert({
        contact_id: contact.id,
        user_id: contact.user_id,
        type: contact.preferred_contact_method || 'other',
        due_date: nextContactDue.toISOString(),
        description: suggestions
      });
    }

    return new Response(
      JSON.stringify({ message: 'Daily check completed successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});