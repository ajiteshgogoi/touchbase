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
  preferred_contact_method: 'call' | 'message' | 'social' | null;
  notes: string | null;
  relationship_level: 1 | 2 | 3 | 4 | 5;
  social_media_handle: string | null;
  contact_frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null;
  ai_last_suggestion: string | null;
  ai_last_suggestion_date: string | null;
  missed_interactions: number;
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

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Tomorrow's date range for new reminders
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // First, handle missed interactions from today
    const { data: missedContacts, error: missedError } = await supabaseClient
      .from('contacts')
      .select(`
        id,
        missed_interactions,
        relationship_level,
        contact_frequency
      `)
      .gte('next_contact_due', today.toISOString())
      .lte('next_contact_due', todayEnd.toISOString());

    if (missedError) throw missedError;

    // Update missed_interactions counter for contacts that were due today
    if (missedContacts && missedContacts.length > 0) {
      await Promise.all(missedContacts.map(async (contact) => {
        await supabaseClient
          .from('contacts')
          .update({
            missed_interactions: (contact.missed_interactions || 0) + 1
          })
          .eq('id', contact.id);
      }));
    }

    // Get all contacts that need attention tomorrow
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('contacts')
      .select(`
        id,
        user_id,
        name,
        last_contacted,
        preferred_contact_method,
        relationship_level,
        contact_frequency,
        social_media_handle,
        notes,
        missed_interactions,
        interactions (
          type,
          date,
          sentiment
        )
      `)
      .gte('next_contact_due', tomorrow.toISOString())
      .lte('next_contact_due', tomorrowEnd.toISOString());

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

    // Get already processed contacts for tomorrow
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Get date only
    const { data: processedContacts, error: processedError } = await supabaseClient
      .from('contact_processing_logs')
      .select('contact_id')
      .eq('processing_date', tomorrowStr);

    if (processedError) throw processedError;

    // Filter out already processed contacts
    const processedContactIds = new Set((processedContacts || []).map(p => p.contact_id));
    const unprocessedContacts = contacts.filter(c => !processedContactIds.has(c.id));

    if (!unprocessedContacts || unprocessedContacts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unprocessed contacts need attention' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Process each unprocessed contact
    const processResults = await Promise.all(unprocessedContacts.map(async (contact: Contact) => {
      try {
        const timeSinceLastContact = contact.last_contacted
          ? Math.floor((Date.now() - new Date(contact.last_contacted).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const userMessage = [
          "Analyze this contact's information and provide 2-3 highly impactful suggestions to strengthen the relationship:",
          "",
          "Contact Details:",
          `- Name: ${contact.name}`,
          `- Last contacted: ${timeSinceLastContact ? timeSinceLastContact + " days ago" : "Never"}`,
          `- Preferred method: ${contact.preferred_contact_method || "Not specified"}`,
          `- Ideal frequency: ${contact.contact_frequency || "Not specified"}`,
          `- Social media: ${contact.social_media_handle || "Not specified"}`,
          `- Relationship level: ${contact.relationship_level}/5`,
          `- Notes: ${contact.notes || "None"}`,
          "",
          "Recent Activity:",
          `${(contact.interactions || []).map(i => `- ${i.type} (${i.sentiment || "neutral"})`).join('\n') || 'None'}`,
          "",
          "Rules for Suggestions:",
          "1. Must be specific to their context and personal details - no generic advice",
          "2. Must be actionable within 24-48 hours",
          "3. Must clearly contribute to relationship growth",
          "4. Each suggestion should start with \"[type: call/message/social]\"",
          "5. Keep suggestions concise and impactful",
          "6. If no clear opportunities exist, return no suggestions",
          "",
          "Provide ONLY the most impactful 1-2 suggestions, each on a new line starting with \"-\"."
        ].join('\n');

        let suggestions;
        try {
          console.log('Making Groq API request for contact:', contact.id);
          const groqResponse = await axiod.post(
            GROQ_API_URL,
            {
              model: 'llama-3.3-70b-versatile',
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
        const getNextContactDate = (
          level: 1 | 2 | 3 | 4 | 5,
          frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null,
          missedInteractions: number = 0
        ) => {
          // Base intervals in days
          const baseIntervals: Record<number, number> = {
            1: 90, // Acquaintance: ~3 months
            2: 60, // Casual friend: ~2 months
            3: 30, // Friend: ~1 month
            4: 14, // Close friend: ~2 weeks
            5: 7   // Very close: ~1 week
          };

          // Get base interval
          let days = baseIntervals[level];

          // Adjust based on specified frequency
          if (frequency) {
            const frequencyDays = {
              'daily': 1,
              'weekly': 7,
              'fortnightly': 14,
              'monthly': 30,
              'quarterly': 90
            }[frequency];
            
            // Use the more frequent of the two options
            days = Math.min(baseIntervals[level], frequencyDays);
          }

          // If there are missed interactions, reduce the interval
          if (missedInteractions > 0) {
            // Calculate reduced interval: divide by 2^missedInteractions
            // But ensure it doesn't go below 1 day to avoid overwhelming
            days = Math.max(1, Math.floor(days / Math.pow(2, missedInteractions)));
          }

          return days;
        };

        // Use type assertion since we know relationship_level is constrained in the schema
        // Default to 1 if relationship_level is not in valid range
        const relationshipLevel = (contact.relationship_level >= 1 && contact.relationship_level <= 5)
          ? (contact.relationship_level as 1 | 2 | 3 | 4 | 5)
          : 1;

        const missedCount = contact.missed_interactions || 0;
        const interval = getNextContactDate(
          relationshipLevel,
          contact.contact_frequency as 'daily' | 'weekly' | 'monthly' | 'quarterly' | null,
          missedCount
        );
        const nextContactDue = new Date();
        nextContactDue.setDate(nextContactDue.getDate() + interval);

        // Determine suggested contact method based on relationship level and missed interactions
        const getSuggestedMethod = (level: number, preferred: string | null, missedInteractions: number) => {
          // If we've missed multiple interactions, escalate the contact method
          if (missedInteractions >= 3) {
            // After 3 misses, prefer calls for more direct contact
            return 'call';
          } else if (missedInteractions >= 2) {
            // After 2 misses, if they prefer messages/social, try calls
            return preferred === 'call' ? 'call' : 'message';
          }

          // Regular logic for contact method
          if (level >= 4) {
            // For close relationships, prefer calls
            return 'call';
          } else if (level >= 2) {
            // For medium relationships, use preferred method or message
            return preferred || 'message';
          }
          // For acquaintances, lighter touch methods are fine
          return 'message';
        };

        const suggestedMethod = getSuggestedMethod(contact.relationship_level, contact.preferred_contact_method, missedCount);

        // Update contact with next due date, AI suggestion, create reminder, and log processing
        const [updateResult, reminderResult, logResult] = await Promise.all([
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
            }),
          supabaseClient
            .from('contact_processing_logs')
            .insert({
              contact_id: contact.id,
              processing_date: tomorrowStr
            })
        ]);

        if (updateResult.error) throw updateResult.error;
        if (reminderResult.error) throw reminderResult.error;
        if (logResult.error) throw logResult.error;

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