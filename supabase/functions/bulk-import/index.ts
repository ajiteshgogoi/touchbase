import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parse } from 'https://esm.sh/csv-parse/sync'
import { createResponse, handleOptions } from '../_shared/headers.ts'

interface Contact {
  name: string
  contact_frequency: string
  phone?: string
  social_media_platform?: string
  social_media_handle?: string
  preferred_contact_method: string
  notes?: string
  important_events: Array<{
    type: 'birthday' | 'anniversary' | 'custom'
    name?: string
    date: string
  }>
}

interface ValidationError {
  row: number
  errors: string[]
}

interface ImportResult {
  success: boolean
  message: string
  successCount: number
  failureCount: number
  errors: ValidationError[]
}

function validateContact(contact: any, rowIndex: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required fields
  if (!contact.name?.trim()) {
    errors.push('Name is required')
  }
  if (!contact.contact_frequency) {
    errors.push('Contact frequency is required')
  }

  // Validate contact frequency
  const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
  if (contact.contact_frequency && !validFrequencies.includes(contact.contact_frequency)) {
    errors.push(`Invalid contact frequency. Must be one of: ${validFrequencies.join(', ')}`)
  }

  // Validate phone number if provided
  if (contact.phone && !/^(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(contact.phone)) {
    errors.push('Invalid phone number format. Must match: +XX-XXX-XXX-XXXX, (XXX) XXX-XXXX, or XXXXXXXXXX')
  }

  // Validate social media fields
  const hasPlatform = Boolean(contact.social_media_platform)
  const hasHandle = Boolean(contact.social_media_handle)
  if ((hasPlatform && !hasHandle) || (!hasPlatform && hasHandle)) {
    errors.push('Both social media platform and handle must be provided if one is set')
  }

  // Validate dates in important events
  if (contact.custom_event_date && !contact.custom_event_name) {
    errors.push('Custom event name is required when date is provided')
  }

  // Check date formats
  const dateFields = [
    { field: 'birthday', value: contact.birthday },
    { field: 'anniversary', value: contact.anniversary },
    { field: 'custom_event_date', value: contact.custom_event_date }
  ]

  dateFields.forEach(({ field, value }) => {
    if (value && !isValidDate(value)) {
      errors.push(`Invalid date format for ${field}. Use YYYY-MM-DD`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors
  }
}

function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return date instanceof Date && !isNaN(date.getTime())
}

async function checkDuplicateContact(name: string, supabase: any, userId: string): Promise<boolean> {
  const { data: duplicates } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)

  return duplicates?.length > 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
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

    // Process upload in memory without storing the file
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return createResponse(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    try {
      // Read and parse CSV in memory
      const csvContent = await file.text()
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      })

      // Clear file data from memory
      formData.delete('file')

      const result: ImportResult = {
        success: true,
        message: 'Import completed',
        successCount: 0,
        failureCount: 0,
        errors: []
      }

      // Process records in batches
      const batchSize = 50
      const batches = []
      for (let i = 0; i < records.length; i += batchSize) {
        batches.push(records.slice(i, i + batchSize))
      }

      for (const batch of batches) {
        const validContacts = []
        
        // Validate each contact in the batch
        for (const [index, record] of batch.entries()) {
          const { isValid, errors } = validateContact(record, index)
          
          if (!isValid) {
            result.failureCount++
            result.errors.push({
              row: index + 1,
              errors
            })
            continue
          }

          // Check for duplicates
          const isDuplicate = await checkDuplicateContact(record.name, supabaseClient, user.id)
          if (isDuplicate) {
            result.failureCount++
            result.errors.push({
              row: index + 1,
              errors: [`Contact with name '${record.name}' already exists`]
            })
            continue
          }

          // Prepare contact data
          const contactData = {
            user_id: user.id,
            name: record.name.trim(),
            contact_frequency: record.contact_frequency,
            phone: record.phone || null,
            social_media_platform: record.social_media_platform || null,
            social_media_handle: record.social_media_handle || null,
            preferred_contact_method: record.preferred_contact_method || 'message',
            notes: record.notes || ''
          }

          validContacts.push(contactData)
        }

        // Insert valid contacts
        if (validContacts.length > 0) {
          const { error: insertError } = await supabaseClient
            .from('contacts')
            .insert(validContacts)

          if (insertError) {
            throw new Error(`Failed to insert contacts: ${insertError.message}`)
          }

          result.successCount += validContacts.length
        }
      }

      // Clear CSV data from memory after processing
      records.length = 0

      return createResponse(result)
    } catch (error) {
      console.error('Error processing bulk import:', error)
      
      return createResponse(
        {
          success: false,
          message: error.message,
          successCount: 0,
          failureCount: 0,
          errors: [{ row: 0, errors: [error.message] }]
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in serve handler:', error)
    return createResponse(
      {
        success: false,
        message: error.message,
        successCount: 0,
        failureCount: 0,
        errors: [{ row: 0, errors: [error.message] }]
      },
      { status: 500 }
    )
  }
})