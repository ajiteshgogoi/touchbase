// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js";
// @ts-ignore
import axiod from "https://deno.land/x/axiod@0.26.0/mod.ts";

// Declare Deno global to satisfy TypeScript.
declare const Deno: any;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
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
  next_contact_due: string | null;
  preferred_contact_method: 'phone' | 'social' | 'text' | null;
  notes: string | null;
  relationship_level: 1 | 2 | 3 | 4 | 5;
  social_media_handle: string | null;
  contact_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | null;
  ai_last_suggestion: string | null;
  ai_last_suggestion_date: string | null;
  interactions: Interaction[];
}

serve(async (req: Request) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const groqApiKey = Deno.env.get('GROQ_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !groqApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
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
        const timeSinceLastContact = contact.last_contacted
          ? Math.floor((Date.now() - new Date(contact.last_contacted).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        // Build user message with relationship-focused context
        const userMessage =
          "Generate personalized interaction suggestions to strengthen this relationship:\n\n" +
          "Contact Information:\n" +
          "- Name: " + contact.name + "\n" +
          "- Last contacted: " + (timeSinceLastContact ? timeSinceLastContact + " days ago" : "Never") + "\n" +
          "- Preferred method: " + (contact.preferred_contact_method || "Not specified") + "\n" +
          "- Ideal frequency: " + (contact.contact_frequency || "Not specified") + "\n" +
          "- Social media: " + (contact.social_media_handle || "Not specified") + "\n" +
          "- Relationship level: " + contact.relationship_level + "/5\n" +
          "- Notes: " + (contact.notes || "None") + "\n\n" +
          "Recent interactions: " + ((contact.interactions || [])
            .map(i => i.type + " (" + (i.sentiment || "neutral") + ")")
            .join(', ') || "None") + "\n\n" +
          "Consider these principles:\n" +
          "1. Phone calls create stronger bonds than texts or social media\n" +
          "2. Regular 'pebbling' (small interactions) helps maintain connection\n" +
          "3. Match contact method to relationship level\n" +
          "4. Use information from notes for personalization\n" +
          "5. Vary contact methods to keep engagement fresh\n\n" +
          "Provide specific, context-aware suggestions that will strengthen this relationship.";

        let suggestions;
        try {
          console.log('Making Groq API request for contact:', contact.id);
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

          console.log('Groq API response status:', groqResponse.status);
          console.log('Groq API response:', JSON.stringify(groqResponse.data));

          if (!groqResponse.data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response structure from Groq API: ' + JSON.stringify(groqResponse.data));
          }

          suggestions = groqResponse.data.choices[0].message.content;
        } catch (groqError: any) {
          console.error('Groq API error:', groqError);
          throw new Error(`Groq API error: ${groqError.message || 'Unknown error'} - ${groqError.response?.data ? JSON.stringify(groqError.response.data) : 'No response data'}`);
        }

        // Calculate next contact due date based on relationship level and contact frequency
        const getNextContactDate = (level: 1 | 2 | 3 | 4 | 5, frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | null) => {
          // Base intervals in days
          const baseIntervals: Record<number, number> = {
            1: 90, // Acquaintance: ~3 months
            2: 60, // Casual friend: ~2 months
            3: 30, // Friend: ~1 month
            4: 14, // Close friend: ~2 weeks
            5: 7   // Very close: ~1 week
          };

          // Adjust based on specified frequency
          if (frequency) {
            const frequencyDays = {
              'daily': 1,
              'weekly': 7,
              'monthly': 30,
              'quarterly': 90
            }[frequency];
            
            // Use the more frequent of the two options
            return Math.min(baseIntervals[level], frequencyDays);
          }

          return baseIntervals[level];
        };

        // Use type assertion since we know relationship_level is constrained in the schema
        // Default to 1 if relationship_level is not in valid range
        const relationshipLevel = (contact.relationship_level >= 1 && contact.relationship_level <= 5)
          ? (contact.relationship_level as 1 | 2 | 3 | 4 | 5)
          : 1;

        const interval = getNextContactDate(
          relationshipLevel,
          contact.contact_frequency as 'daily' | 'weekly' | 'monthly' | 'quarterly' | null
        );
        const nextContactDue = new Date();
        nextContactDue.setDate(nextContactDue.getDate() + interval);

        // Determine suggested contact method based on relationship level
        const getSuggestedMethod = (level: number, preferred: string | null) => {
          if (level >= 4) {
            // For close relationships, prefer phone calls
            return 'phone';
          } else if (level >= 2) {
            // For medium relationships, use preferred method or text
            return preferred || 'text';
          }
          // For acquaintances, lighter touch methods are fine
          return 'social';
        };

        const suggestedMethod = getSuggestedMethod(contact.relationship_level, contact.preferred_contact_method);

        // Update contact with next due date, AI suggestion, and create reminder
        const [updateResult, reminderResult] = await Promise.all([
          supabaseClient
            .from('contacts')
            .update({
              next_contact_due: nextContactDue.toISOString(),
              ai_last_suggestion: suggestions,
              ai_last_suggestion_date: new Date().toISOString()
            })
            .eq('id', contact.id),
          supabaseClient
            .from('reminders')
            .insert({
              contact_id: contact.id,
              user_id: contact.user_id,
              type: suggestedMethod,
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
        console.error('Error processing contact:', error);
        return {
          contactId: contact.id,
          status: 'error',
          error: error.message || 'Unknown error',
          details: JSON.stringify(error)
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