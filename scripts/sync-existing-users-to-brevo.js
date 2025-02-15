import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BREVO_API_KEY = process.env.BREVO_API_KEY
const BATCH_SIZE = 50 // Process in batches to avoid rate limits

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BREVO_API_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function addContactToBrevo(user) {
  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY
    },
    body: JSON.stringify({
      email: user.email,
      attributes: {
        FIRSTNAME: user.user_metadata?.name?.split(' ')[0] || '',
        LASTNAME: user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
        SIGN_UP_DATE: user.created_at
      },
      listIds: [4], // Replace with your actual Brevo list ID
      updateEnabled: true
    })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Failed to sync user to Brevo: ${JSON.stringify(data)}`)
  }
  return data
}

async function syncUsersToBrevo() {
  let count = 0
  let lastId = null
  let hasMore = true
  
  while (hasMore) {
    try {
      // Fetch users in batches
      let query = supabase.auth.admin.listUsers({
        perPage: BATCH_SIZE,
      })
      
      if (lastId) {
        query = supabase.auth.admin.listUsers({
          perPage: BATCH_SIZE,
          page: Math.floor(count / BATCH_SIZE) + 1
        })
      }

      const { data: { users }, error } = await query

      if (error) {
        console.error('Error fetching users:', error)
        break
      }

      if (!users || users.length === 0) {
        hasMore = false
        continue
      }

      // Process each user in the batch
      for (const user of users) {
        try {
          const result = await addContactToBrevo(user)
          console.log(`✓ Synced user ${user.email} to Brevo (ID: ${result.id})`)
          count++
          lastId = user.id
        } catch (error) {
          console.error(`✗ Failed to sync user ${user.email}:`, error.message)
        }
        
        // Add a small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Processed ${count} users so far...`)

      // Check if we've processed all users
      if (users.length < BATCH_SIZE) {
        hasMore = false
      }

    } catch (error) {
      console.error('Batch processing error:', error)
      break
    }
  }

  console.log(`\nSync complete! Processed ${count} users in total.`)
}

// Run the sync
syncUsersToBrevo().catch(console.error)