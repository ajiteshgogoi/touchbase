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
    tomorrow.setDate(tomorrow.getDate());  // Start from today to catch UTC conversions
    tomorrow.setHours(12, 0, 0, 0);  // Start from noon UTC today
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);  // End 24h later
    tomorrowEnd.setHours(12, 0, 0, 0);

    console.log('Checking for tomorrow\'s contacts between:', tomorrow.toISOString(), 'and', tomorrowEnd.toISOString());

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

    // Handle missed interactions from today
    if (missedContacts && missedContacts.length > 0) {
      await Promise.all(missedContacts.map(async (contact) => {
        // Get latest interaction to verify it's really missed
        const { data: latestInteraction } = await supabaseClient
          .from('interactions')
          .select('date')
          .eq('contact_id', contact.id)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        // Get contact to check preferred method
        const { data: fullContact } = await supabaseClient
          .from('contacts')
          .select('*')
          .eq('id', contact.id)
          .single();

        if (!fullContact) {
          console.error('Contact not found:', contact.id);
          return;
        }

        // Only count as missed if:
        // 1. Today is the due date (we already filtered for this)
        // 2. No interaction was logged today
        // 3. Due date is not in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(fullContact.next_contact_due);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate.getTime() === today.getTime() && // Due today
            (!latestInteraction || // No interactions
             new Date(latestInteraction.date).setHours(0, 0, 0, 0) < today.getTime())) { // Or last interaction was before today
          try {
            const nextContactDue = getNextContactDate(
              fullContact.relationship_level,
              fullContact.contact_frequency,
              (fullContact.missed_interactions || 0) + 1
            );

            // Update contact first
            await supabaseClient
              .from('contacts')
              .update({
                missed_interactions: (fullContact.missed_interactions || 0) + 1,
                next_contact_due: nextContactDue.toISOString()
              })
              .eq('id', contact.id);

            // Then handle reminder
            await supabaseClient
              .from('reminders')
              .delete()
              .eq('contact_id', contact.id);

            await supabaseClient.from('reminders').insert({
              contact_id: contact.id,
              user_id: fullContact.user_id,
              type: fullContact.preferred_contact_method || 'message',
              due_date: nextContactDue.toISOString(),
              description: fullContact.notes || undefined
            });
          } catch (error) {
            console.error('Error handling missed interaction:', error);
          }
        }
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
        next_contact_due,
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

    if (contactsError) {
      console.error('Error fetching tomorrow\'s contacts:', contactsError);
      throw contactsError;
    }

    console.log('Found contacts for tomorrow:', contacts?.length || 0);
    if (contacts?.length) {
      console.log('Contact due dates:', contacts.map(c => ({
        id: c.id,
        name: c.name,
        next_contact_due: c.next_contact_due
      })));
    } else {
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
    console.log('Checking processed contacts for date:', tomorrowStr);
    
    const { data: processedContacts, error: processedError } = await supabaseClient
      .from('contact_processing_logs')
      .select('contact_id')
      .eq('processing_date', tomorrowStr);

    if (processedError) {
      console.error('Error fetching processed contacts:', processedError);
      throw processedError;
    }

    console.log('Found processed contacts:', processedContacts?.length || 0);

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
          `- Preferred contact frequency: ${contact.contact_frequency || "Not specified"}`,          
          `- Relationship level: ${contact.relationship_level}/5`,
          `- Notes: ${contact.notes || "None"}`,
          "",
          "Recent Activity (chronological):",
          `${(contact.interactions || [])
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(i => `- ${new Date(i.date).toLocaleDateString()}: ${i.type} (${i.sentiment || "neutral"})${i.notes ? `\n  Notes: ${i.notes}` : ''}`).join('\n') || 'None'}`,
          "",
          "Rules for Suggestions:",
          "1. Must be specific to their context and personal details — no generic advice",
          "2. Must be actionable within 24-48 hours",
          "3. Must clearly contribute to relationship growth",
          "4. Each suggestion should start with \"[type: call/message/social]\"",
          "5. Keep suggestions concise and impactful",
          "6. If no clear opportunities exist, return no suggestions",
          "",
          "Provide ONLY the most impactful 1-2 suggestions, each on a new line starting with \"•\""
        ].join('\n');

        // Check subscription status
        const { data: subscription, error: subError } = await supabaseClient
          .from('subscriptions')
          .select('plan_id, valid_until')
          .eq('user_id', contact.user_id)
          .single();

        if (subError) {
          console.error('Error fetching subscription:', subError);
          throw subError;
        }

        const isPremium = subscription?.plan_id === 'premium' &&
          subscription.valid_until &&
          new Date(subscription.valid_until) > new Date();

        let suggestions;
        if (isPremium) {
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
        } else {
          suggestions = '<div class="bg-yellow-50 p-3 rounded-lg"><strong>Important:</strong> Upgrade to premium to get advanced AI suggestions!</div>';
        }

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

        const suggestedMethod = getSuggestedMethod(contact.relationship_level, contact.preferred_contact_method, contact.missed_interactions || 0);

        // Update contact with AI suggestion and log processing
        const [updateResult, reminderResult, logResult] = await Promise.all([
          supabaseClient
            .from('contacts')
            .update({
              ai_last_suggestion: suggestions,
              ai_last_suggestion_date: new Date().toISOString()
            })
            .eq('id', contact.id),
          // No need to handle reminders here - they're managed by the frontend
          Promise.resolve(),
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