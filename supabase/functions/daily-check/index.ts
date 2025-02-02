// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js";
// @ts-ignore
import axiod from "https://deno.land/x/axiod@0.26.0/mod.ts";

// Declare Deno global to satisfy TypeScript.
declare const Deno: any;

const GROQ_API_URL = 'https://api.groq.com/v1/chat/completions';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Interaction {
  type: string;
  date: string;
  sentiment?: string;
}

interface Contact {
  id: string;
  user_id: string;
  name: string;
  last_contacted: string | null;
  preferred_contact_method: string | null;
  relationship_level: 1 | 2 | 3 | 4 | 5;
  interactions: Interaction[];
}

serve(async (req: Request) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const groqApiKey = Deno.env.get('GROQ_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !groqApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Compute current time for comparison.
    const now = new Date().toISOString();

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
      .or(`next_contact_due.is.null,next_contact_due.lte.${now}`);

    if (contactsError) throw contactsError;
    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No contacts need attention' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Process each contact
    const processResults = await Promise.all(contacts.map(async (contact: Contact) => {
      try {
        // Build user message without nested template literals.
        const userMessage =
          "Generate personalized interaction suggestions for this contact:\n" +
          "Name: " + contact.name + "\n" +
          "Last contacted: " + (contact.last_contacted || "Never") + "\n" +
          "Preferred method: " + (contact.preferred_contact_method || "Not specified") + "\n" +
          "Relationship level: " + contact.relationship_level + "/5\n" +
          "Recent interactions: " + ((contact.interactions || [])
            .map(i => i.type + " (" + (i.sentiment || "neutral") + ")")
            .join(', ') || "None");

        const groqResponse = await axiod.post(
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
                content: userMessage
              }
            ],
            temperature: 0.7,
            max_tokens: 250
          },
          {
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!groqResponse.data ||
            !groqResponse.data.choices ||
            !groqResponse.data.choices[0] ||
            !groqResponse.data.choices[0].message ||
            !groqResponse.data.choices[0].message.content) {
          throw new Error('Invalid response from Groq API');
        }

        const suggestions = groqResponse.data.choices[0].message.content;

        // Calculate next contact due date based on relationship level
        const daysUntilNext: Record<number, number> = {
          1: 90,
          2: 60,
          3: 30,
          4: 14,
          5: 7
        };

        const nextContactDue = new Date();
        const interval = daysUntilNext[contact.relationship_level] || 30;
        nextContactDue.setDate(nextContactDue.getDate() + interval);

        // Update contact with next due date and create reminder
        const [updateResult, reminderResult] = await Promise.all([
          supabaseClient
            .from('contacts')
            .update({
              next_contact_due: nextContactDue.toISOString()
            })
            .eq('id', contact.id),
          supabaseClient
            .from('reminders')
            .insert({
              contact_id: contact.id,
              user_id: contact.user_id,
              type: contact.preferred_contact_method || 'other',
              due_date: nextContactDue.toISOString(),
              description: suggestions
            })
        ]);

        if (updateResult.error) throw updateResult.error;
        if (reminderResult.error) throw reminderResult.error;

        return {
          contactId: contact.id,
          status: 'success'
        };
      } catch (error: any) {
        return {
          contactId: contact.id,
          status: 'error',
          error: error.message
        };
      }
    }));

    return new Response(
      JSON.stringify({
        message: 'Daily check completed',
        results: processResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});