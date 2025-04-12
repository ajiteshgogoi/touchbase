import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import JSZip from 'https://esm.sh/jszip@3.10.1'
import { createResponse, handleOptions } from '../_shared/headers.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' }
        }
      }
    )

    // Get the session from the request
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return createResponse(
        { error: 'No authorization header' },
        { status: 401 }
      )
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authorization.replace('Bearer ', '')
    )

    if (userError || !user) {
      return createResponse(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get user's timezone preference
    const { data: userPref } = await supabaseClient
      .from('user_preferences')
      .select('timezone')
      .eq('user_id', user.id)
      .single()

    const timezone = userPref?.timezone || 'UTC'

    // Helper function to fetch paginated data
    async function fetchAllData<T>(
      table: string,
      orderColumn: string,
      ascending: boolean = true
    ): Promise<T[]> {
      let allData: T[] = [];
      let page = 0;
      const pageSize = 950; // Stay well under 1000 limit
      
      while (true) {
        const { data, error } = await supabaseClient
          .from(table)
          .select('*')
          .eq('user_id', user.id)
          .order(orderColumn, { ascending })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        
        // If we got less than pageSize, we've reached the end
        if (data.length < pageSize) break;
        
        page++;
      }
      
      return allData;
    }

    // Fetch all data with pagination
    const contacts = await fetchAllData('contacts', 'name');
    
    // Create a contact name lookup
    const contactMap = new Map(contacts?.map(c => [c.id, c.name]) || []);

    // Get other data with pagination
    const [interactions, importantEvents, reminders] = await Promise.all([
      fetchAllData('interactions', 'date'),
      fetchAllData('important_events', 'date'),
      fetchAllData('reminders', 'due_date')
    ]);

    // Create CSV content for each type
    const contactsCSV = [
      'name,email,phone,social_media_platform,social_media_handle,last_contacted,next_contact_due,preferred_contact_method,notes,contact_frequency', // Add email header
      ...contacts.map(c =>
        `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.social_media_platform || ''}","${c.social_media_handle || ''}","${new Date(c.last_contacted).toLocaleString('en-US', { timeZone: timezone })}","${new Date(c.next_contact_due).toLocaleString('en-US', { timeZone: timezone })}","${c.preferred_contact_method || ''}","${(c.notes || '').replace(/"/g, '""')}","${c.contact_frequency}"` // Add email data
      )
    ].join('\n')

    const interactionsCSV = [
      'contact_name,type,date,notes,sentiment',
      ...interactions.map(i =>
        `"${contactMap.get(i.contact_id) || ''}","${i.type}","${new Date(i.date).toLocaleString('en-US', { timeZone: timezone })}","${(i.notes || '').replace(/"/g, '""')}","${i.sentiment || ''}"`
      )
    ].join('\n')

    const eventsCSV = [
      'contact_name,type,name,date',
      ...importantEvents.map(e =>
        `"${contactMap.get(e.contact_id) || ''}","${e.type}","${(e.name || '').replace(/"/g, '""')}","${new Date(e.date).toLocaleString('en-US', { timeZone: timezone })}"`
      )
    ].join('\n')

    const remindersCSV = [
      'contact_name,type,due_date,completed,name',
      ...reminders.map(r =>
        `"${contactMap.get(r.contact_id) || ''}","${r.type}","${new Date(r.due_date).toLocaleString('en-US', { timeZone: timezone })}","${r.completed}","${(r.name || '').replace(/"/g, '""')}"`
      )
    ].join('\n')

    // Create ZIP file
    const zip = new JSZip()
    zip.file('contacts.csv', contactsCSV)
    zip.file('interactions.csv', interactionsCSV)
    zip.file('important_events.csv', eventsCSV)
    zip.file('reminders.csv', remindersCSV)

    // Generate README with explanations
    const readme = `TouchBase Data Export

This archive contains your exported data in CSV format:

1. contacts.csv: Your contact list with basic information and communication preferences
2. interactions.csv: History of all interactions with your contacts
3. important_events.csv: Important dates like birthdays and anniversaries
4. reminders.csv: All reminders (completed and pending)

All dates are in your timezone: ${timezone}
Export date: ${new Date().toLocaleString('en-US', { timeZone: timezone })}
    `
    zip.file('README.txt', readme)

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const zipBuffer = await zipBlob.arrayBuffer()

    // Return ZIP file with simplified filename for mobile compatibility
    const headers = new Headers(createResponse({}).headers)
    headers.set('Content-Type', 'application/zip')
    headers.set('Content-Disposition', 'attachment; filename=touchbase_export.zip')
    
    return new Response(zipBuffer, { headers })

  } catch (error) {
    console.error('Error in export:', error)
    return createResponse(
      { error: error.message },
      { status: 500 }
    )
  }
})