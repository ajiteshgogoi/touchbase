// supabase/functions/llm-chat-handler/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createResponse, handleOptions } from '../_shared/headers.ts'

// Define types for expected request/response structures (can be refined)
interface ChatRequest {
  message: string;
  context?: { // Optional context, e.g., current contact page
    contactId?: string;
  };
  confirmation?: { // Sent when user confirms an action
    confirm: boolean;
    action_details: ActionDetails;
  };
}

interface ActionDetails {
  action: string; // e.g., 'rpc_log_interaction', 'update_contact', 'create_reminder'
  params: Record<string, any>; // Parameters for the action
  contact_id?: string; // Resolved contact ID
}

interface ChatResponse {
  reply?: string; // Direct answer from LLM or system message
  confirmation_required?: boolean;
  message?: string; // Message to display for confirmation
  action_details?: ActionDetails; // Details needed for confirmation step
  error?: string;
}

// --- Helper: Check Premium/Trial Status ---
async function isUserPremiumOrTrial(supabaseClient: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from('subscriptions')
    .select('status, trial_end_date, valid_until')
    .eq('user_id', userId)
    .eq('plan_id', 'premium')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: No rows found (expected for free users)
    console.error('Error fetching subscription:', error);
    return false; // Default to false on error
  }

  if (!data) {
    return false; // No premium subscription found
  }

  const now = new Date();

  // Check if subscription is active and not expired
  if (data.status === 'active' && new Date(data.valid_until) > now) {
    return true;
  }

  // Check if trial is still valid
  if (data.trial_end_date) {
    const trialEndDate = new Date(data.trial_end_date);
    if (trialEndDate > now) {
      return true;
    }
  }

  return false; // Otherwise, not premium or on active trial
}
// --- Main Handler ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    // 1. Initialize Supabase Client & Authenticate User
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Use anon key for initial auth check
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? ''
          }
        }
      }
    );

    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return createResponse({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth Error:', userError);
      return createResponse({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // Create a service role client for subsequent operations needing elevated privileges
    // IMPORTANT: Ensure SUPABASE_SERVICE_ROLE_KEY is set in your Edge Function environment variables
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );


    // 2. Check Premium/Trial Status
    const isAllowed = await isUserPremiumOrTrial(supabaseAdminClient, user.id);
    if (!isAllowed) {
      return createResponse({ error: 'Forbidden: This feature requires a Premium subscription or active trial.' }, { status: 403 });
    }

    // 3. Parse Request Body
    const requestBody: ChatRequest = await req.json();

    // 4. Handle Confirmation Flow OR Initial Request
    if (requestBody.confirmation) {
      // --- Confirmation Handling ---
      if (requestBody.confirmation.confirm && requestBody.confirmation.action_details) {
        const { action, params, contact_id } = requestBody.confirmation.action_details;
        console.log(`Executing confirmed action: ${action} for user ${user.id}`, params);

        // --- Action Execution Logic ---
        try {
          if (action === 'rpc_log_interaction') {
            if (!contact_id) throw new Error("Contact ID is required for log_interaction.");
            
            // Validate interaction type
            if (!['call', 'message', 'social', 'meeting'].includes(params.type)) {
              throw new Error("Invalid interaction type. Must be one of: 'call', 'message', 'social', 'meeting'");
            }

            // Validate sentiment if provided
            if (params.sentiment && !['positive', 'neutral', 'negative'].includes(params.sentiment)) {
              throw new Error("Invalid sentiment. Must be one of: 'positive', 'neutral', 'negative'");
            }

            const { data: result, error: rpcError } = await supabaseAdminClient.rpc('log_interaction_and_update_contact', {
              p_contact_id: contact_id,
              p_user_id: user.id,
              p_type: params.type,
              p_date: params.date || new Date().toISOString(),
              p_notes: params.notes || null,
              p_sentiment: params.sentiment || null
            });

            if (rpcError) throw rpcError;
            if (!result?.interaction_id) throw new Error("Failed to log interaction");

            return createResponse({
              reply: `Interaction logged successfully${result.contact_updated ? ' and contact updated' : ''}.`
            });

          } else if (action === 'update_contact') {
            if (!contact_id) throw new Error("Contact ID is required for update_contact.");
            if (!params.field_to_update || params.new_value === undefined) throw new Error("Field and new value required for update_contact.");

            // Validate field and value based on schema constraints
            switch (params.field_to_update) {
              case 'social_media_platform':
                if (!['linkedin', 'instagram', 'twitter', null].includes(params.new_value)) {
                  throw new Error("Invalid social media platform. Must be one of: 'linkedin', 'instagram', 'twitter'");
                }
                break;
              case 'preferred_contact_method':
                if (!['call', 'message', 'social', null].includes(params.new_value)) {
                  throw new Error("Invalid contact method. Must be one of: 'call', 'message', 'social'");
                }
                break;
              case 'contact_frequency':
                if (!['every_three_days', 'weekly', 'fortnightly', 'monthly', 'quarterly'].includes(params.new_value)) {
                  throw new Error("Invalid contact frequency. Must be one of: 'every_three_days', 'weekly', 'fortnightly', 'monthly', 'quarterly'");
                }
                break;
              case 'name':
              case 'phone':
              case 'social_media_handle':
              case 'notes':
                // These fields accept any string value
                break;
              default:
                throw new Error(`Cannot update field: ${params.field_to_update}. Field not recognized or not updateable.`);
            }

            const { error: updateError } = await supabaseAdminClient
              .from('contacts')
              .update({ [params.field_to_update]: params.new_value })
              .eq('user_id', user.id)
              .eq('id', contact_id);

            if (updateError) throw updateError;

            return createResponse({ reply: "Contact updated successfully." });

          } else if (action === 'create_reminder') {
             if (!contact_id) throw new Error("Contact ID is required for create_reminder.");
             if (!params.name || !params.due_date) throw new Error("Reminder name and due date are required.");
             
             // Validate reminder type
             const reminderType = params.type || 'message';
             if (!['call', 'message', 'social'].includes(reminderType)) {
               throw new Error("Invalid reminder type. Must be one of: 'call', 'message', 'social'");
             }

             // Parse and validate due_date
             const dueDate = new Date(params.due_date);
             if (isNaN(dueDate.getTime())) {
               throw new Error("Invalid due date format. Please use ISO 8601 format.");
             }

             // Create reminder
             const { data: reminderData, error: reminderError } = await supabaseAdminClient
               .from('reminders')
               .insert({
                 contact_id: contact_id,
                 user_id: user.id,
                 type: reminderType,
                 name: params.name,
                 due_date: dueDate.toISOString(),
                 completed: false
               })
               .select()
               .single();

             if (reminderError) throw reminderError;

             if (params.is_important) {
                const { error: eventError } = await supabaseAdminClient
                  .from('important_events')
                  .insert({
                    contact_id: contact_id,
                    user_id: user.id,
                    type: 'custom',
                    name: params.name,
                    date: params.due_date // Assuming due_date is just date part for event
                  });
                 if (eventError && eventError.code !== '23505') { // Ignore unique constraint violation if event already exists
                    console.error("Error creating important event:", eventError);
                    // Don't fail the whole operation for this
                 }
                 // Use standard contact update to recalculate next due date
                 const { error: updateError } = await supabaseAdminClient
                   .from('contacts')
                   .update({
                     next_contact_due: new Date().toISOString() // Trigger recalculation
                   })
                   .eq('id', contact_id);
                 
                 if (updateError) {
                   console.error("Error updating contact:", updateError);
                   // Don't fail the operation, but log the error
                 }
             }
             return createResponse({ reply: "Reminder created successfully." });

          } else if (action === 'delete_contact') {
             if (!contact_id) throw new Error("Contact ID is required for delete_contact.");
             // Use service role to bypass RLS for cascade delete if needed, or ensure RLS allows delete
             const { error: deleteError } = await supabaseAdminClient
               .from('contacts')
               .delete()
               .eq('user_id', user.id) // RLS check
               .eq('id', contact_id);
             if (deleteError) throw deleteError;
             return createResponse({ reply: "Contact deleted successfully." });

          } else if (action === 'get_contact_info') {
             // This action should ideally be handled in the initial request phase,
             // but include a fallback just in case.
             if (!contact_id) throw new Error("Contact ID is required for get_contact_info.");
             if (!params.info_needed) throw new Error("Info needed field is required.");
             const { data: contactInfo, error: infoError } = await supabaseAdminClient
               .from('contacts')
               .select(params.info_needed) // Select only the requested field
               .eq('user_id', user.id) // RLS check
               .eq('id', contact_id)
               .single();
             if (infoError) throw infoError;
             if (!contactInfo) return createResponse({ reply: "Could not find the requested information." });
             return createResponse({ reply: `The ${params.info_needed.replace(/_/g, ' ')} is: ${contactInfo[params.info_needed]}` });

          } else {
            console.warn(`Unhandled confirmed action: ${action}`);
            return createResponse({ error: `Action '${action}' is not implemented yet.` }, { status: 501 });
          }
        } catch (execError) {
           console.error(`Error executing action ${action}:`, execError);
           return createResponse({ error: `Failed to execute action: ${execError.message}` }, { status: 500 });
        }

      } else {
        // User cancelled
        return createResponse({ reply: "Action cancelled." });
      }

    } else {
      // --- Initial Request Processing ---
      const userMessage = requestBody.message;
      const context = requestBody.context; // e.g., { contactId: '...' }

      console.log(`Processing message for user ${user.id}: "${userMessage}"`, context);

      // 5. Call LLM (OpenRouter - Gemini Flash)
      const openRouterApiKey = Deno.env.get('GROQ_API_KEY');
      if (!openRouterApiKey) {
        throw new Error("GROQ_API_KEY environment variable not set.");
      }

      const systemPrompt = `You are an AI assistant for the TouchBase CRM. Your goal is to understand user requests and identify the correct action and parameters to interact with the CRM database.

IMPORTANT: When logging interactions, always use one of these exact types: 'call', 'message', 'social', 'meeting'. These are the only valid interaction types in the database.

Available actions and their required parameters:
- log_interaction: { contact_name: string, type: 'call'|'message'|'social'|'meeting'|'other', notes?: string, sentiment?: 'positive'|'neutral'|'negative', date?: string (ISO 8601, default to now if not specified) }
- update_contact: { contact_name: string, field_to_update: string (e.g., 'phone', 'notes', 'contact_frequency', 'social_media_handle'), new_value: string }
- create_reminder: { contact_name: string, name: string (reminder description), due_date: string (ISO 8601), type?: 'call'|'message'|'social', is_important?: boolean (default false) }
- get_contact_info: { contact_name: string, info_needed: string (e.g., 'phone', 'last_contacted', 'notes', 'next_contact_due', 'contact_frequency') }
- delete_contact: { contact_name: string }

Rules:
- Always identify the contact by name using the 'contact_name' parameter. The backend will resolve the ID.
- If the user request is ambiguous (e.g., missing required parameters like type for log_interaction, name/due_date for reminder), ask for clarification. DO NOT guess parameters.
- If the request is a simple question not matching an action, provide a direct answer if possible or state you cannot perform that query. Use the 'reply' field for this.
- Respond ONLY with a valid JSON object containing 'action' and 'params', OR 'reply' for direct answers/clarifications, OR 'error'.
- Examples:
  {"action": "log_interaction", "params": {"contact_name": "Jane Doe", "type": "call", "notes": "Discussed project"}}
  {"action": "create_reminder", "params": {"contact_name": "Bob", "name": "Follow up on proposal", "due_date": "2025-04-15T09:00:00Z"}}
  {"reply": "Which contact do you want to update?"}
  {"error": "Could not understand the request."}
`;

      const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-pro", // Use latest Gemini model for better results
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          response_format: { type: "json_object" } // Request JSON output
        })
      });

      if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        console.error("LLM API Error:", llmResponse.status, errorBody);
        throw new Error(`LLM API request failed: ${llmResponse.status}`);
      }

      const llmResult = await llmResponse.json();
      // Safely parse the potentially nested JSON string
      let llmJsonOutput: ChatResponse = {};
      try {
        const content = llmResult.choices?.[0]?.message?.content;
        if (!content) {
           throw new Error("LLM response content is missing or empty.");
        }

        // Handle markdown-formatted JSON by removing markdown if present
        let jsonContent = content;
        if (content.includes('```json')) {
           // Extract JSON from markdown code block
           const match = content.match(/```json\s*(\{.*?\})\s*```/s);
           if (match && match[1]) {
               jsonContent = match[1];
           } else {
               throw new Error("Could not extract JSON from markdown response");
           }
        }

        llmJsonOutput = JSON.parse(jsonContent);
      } catch (parseError) {
         console.error("Failed to parse LLM JSON output:", parseError, llmResult.choices?.[0]?.message?.content);
         throw new Error("Failed to parse response from AI model.");
      }


      console.log("LLM Output:", llmJsonOutput);

      // 6. Parse LLM Response & Prepare Confirmation/Reply
      if (llmJsonOutput.error) {
        return createResponse({ error: llmJsonOutput.error });
      } else if (llmJsonOutput.reply) {
        return createResponse({ reply: llmJsonOutput.reply });
      } else if (llmJsonOutput.action && llmJsonOutput.params) {
        const { action, params } = llmJsonOutput;
        const contactName = params.contact_name;

        if (!contactName && action !== 'reply' && action !== 'error') {
           return createResponse({ reply: "Please specify which contact you're referring to." });
        }

        let resolvedContactId: string | undefined = context?.contactId;

        // Resolve contact name to ID if needed
        if (contactName) {
           const { data: contactData, error: contactError } = await supabaseAdminClient
            .from('contacts')
            .select('id, name') // Select name for confirmation message
            .eq('user_id', user.id)
            .ilike('name', contactName)
            .limit(2);

          if (contactError) throw contactError;

          if (!contactData || contactData.length === 0) {
            return createResponse({ reply: `Sorry, I couldn't find a contact named "${contactName}".` });
          } else if (contactData.length > 1) {
            return createResponse({ reply: `Found multiple contacts named "${contactName}". Can you be more specific?` });
          } else {
            resolvedContactId = contactData[0].id;
            // Use the exact name from DB for confirmation message consistency
            params.contact_name = contactData[0].name;
          }
        }

        // If it's a 'get_contact_info' action, execute it directly without confirmation
        if (action === 'get_contact_info') {
           if (!resolvedContactId) return createResponse({ reply: `Couldn't find contact "${contactName}" to get info.` });
           if (!params.info_needed) return createResponse({ reply: "What information do you need?" });

           // Validate requested field exists in contacts table
           const validFields = ['name', 'phone', 'social_media_platform', 'social_media_handle',
                              'last_contacted', 'next_contact_due', 'preferred_contact_method',
                              'notes', 'contact_frequency', 'missed_interactions'];
           if (!validFields.includes(params.info_needed)) {
              return createResponse({ reply: `Sorry, I cannot retrieve '${params.info_needed}'. Valid fields are: ${validFields.join(', ')}` });
           }

           const { data: contactInfo, error: infoError } = await supabaseAdminClient
             .from('contacts')
             .select(params.info_needed)
             .eq('user_id', user.id)
             .eq('id', resolvedContactId)
             .single();

           if (infoError) {
              console.error('Error fetching contact info:', infoError);
              return createResponse({ reply: `Sorry, I encountered an error retrieving that information.` });
           }

           if (!contactInfo || contactInfo[params.info_needed] === null || contactInfo[params.info_needed] === undefined) {
              return createResponse({ reply: `No ${params.info_needed.replace(/_/g, ' ')} found for ${params.contact_name}.` });
           }

           // Format dates nicely
           let value = contactInfo[params.info_needed];
           if (['last_contacted', 'next_contact_due'].includes(params.info_needed)) {
              if (!value) {
                 return createResponse({ reply: `No ${params.info_needed.replace(/_/g, ' ')} set for ${params.contact_name}.` });
              }
              try {
                 const date = new Date(value);
                 if (isNaN(date.getTime())) {
                    console.error('Invalid date:', value);
                    return createResponse({ reply: `Sorry, I encountered an error formatting the date.` });
                 }
                 value = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
              } catch (error) {
                 console.error('Date formatting error:', error);
                 return createResponse({ reply: `Sorry, I encountered an error formatting the date.` });
              }
           }

           return createResponse({ reply: `The ${params.info_needed.replace(/_/g, ' ')} for ${params.contact_name} is: ${value}` });
        }


        // Ensure contact ID is resolved for actions that require it before confirmation
        if (!resolvedContactId && ['log_interaction', 'update_contact', 'create_reminder', 'delete_contact'].includes(action)) {
             return createResponse({ reply: `Please specify which contact you mean for the action: ${action}.` });
        }

        // --- Create User-Friendly Confirmation Message ---
        let confirmationMessage = "Please confirm the action:";
        const contactDisplayName = params.contact_name || "the current contact"; // Use resolved name

        switch (action) {
            case 'log_interaction':
                confirmationMessage = `Log ${params.type || 'interaction'} for ${contactDisplayName}?`;
                if (params.notes) confirmationMessage += ` Notes: "${params.notes}"`;
                if (params.sentiment) confirmationMessage += ` Sentiment: ${params.sentiment}`;
                break;
            case 'update_contact':
                confirmationMessage = `Update ${params.field_to_update?.replace(/_/g, ' ')} for ${contactDisplayName} to "${params.new_value}"?`;
                break;
            case 'create_reminder':
                confirmationMessage = `Create reminder for ${contactDisplayName}: "${params.name}" due ${new Date(params.due_date).toLocaleDateString()}?`;
                if (params.is_important) confirmationMessage += " (Marked as important)";
                break;
            case 'delete_contact':
                confirmationMessage = `Are you sure you want to delete ${contactDisplayName}? This cannot be undone.`;
                break;
            default:
                 confirmationMessage = `Confirm action '${action}' for ${contactDisplayName}?`;
        }


        const actionDetails: ActionDetails = {
          action: action,
          params: params, // Pass original params from LLM
          contact_id: resolvedContactId
        };

        return createResponse({
          confirmation_required: true,
          message: confirmationMessage,
          action_details: actionDetails
        });

      } else {
        // Fallback if LLM response is unexpected
        console.warn("Unexpected LLM response format:", llmJsonOutput);
        return createResponse({ reply: "Sorry, I couldn't process that request. Can you try rephrasing?" });
      }
    }

  } catch (error) {
    console.error('Handler Error:', error);
    // Check if the error is a Response object (e.g., from createResponse)
    if (error instanceof Response) {
        return error;
    }
    return createResponse(
      { error: error.message || 'An internal error occurred' },
      { status: 500 }
    );
  }
});