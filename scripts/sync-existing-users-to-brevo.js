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

// Keep track of failed users to retry them
const failedUsers = new Set()

async function addContactToBrevo(user) {
  try {
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
        listIds: [2], // Replace with your actual Brevo list ID
        updateEnabled: true
      })
    })

    // First check if the response is valid JSON
    let data
    const text = await response.text()
    try {
      data = JSON.parse(text)
    } catch (e) {
      throw new Error(`Invalid response from Brevo: ${text}`)
    }

    // Then check if the request was successful
    if (!response.ok) {
      // Check if user already exists (this is fine, we can update)
      if (response.status === 400 && data.code === 'duplicate_parameter') {
        console.log(`User ${user.email} already exists in Brevo, skipping...`)
        return { id: data.message.match(/\d+/)?.[0] || 'existing' }
      }
      throw new Error(data.message || 'Unknown error')
    }

    return data
  } catch (error) {
    // Add to failed users set for retry
    failedUsers.add(user.email)
    throw error
  }
}

async function syncUsersToBrevo(retryMode = false) {
  let count = 0
  let lastId = null
  let hasMore = true
  let successCount = 0
  let failureCount = 0
  
  // If in retry mode, only process failed users
  const usersToProcess = retryMode ? Array.from(failedUsers) : null
  
  while (hasMore) {
    try {
      let users
      
      if (retryMode) {
        // In retry mode, process from our failed users list
        const start = count
        users = usersToProcess.slice(start, start + BATCH_SIZE)
        hasMore = users.length === BATCH_SIZE
      } else {
        // Normal mode, fetch from Supabase
        const { data: { users: fetchedUsers }, error } = await supabase.auth.admin.listUsers({
          perPage: BATCH_SIZE,
          page: Math.floor(count / BATCH_SIZE) + 1
        })

        if (error) {
          console.error('Error fetching users:', error)
          break
        }

        if (!fetchedUsers || fetchedUsers.length === 0) {
          hasMore = false
          continue
        }

        users = fetchedUsers
        hasMore = fetchedUsers.length === BATCH_SIZE
      }

      // Process each user in the batch
      for (const user of users) {
        const email = retryMode ? user : user.email
        try {
          if (!retryMode || (retryMode && failedUsers.has(email))) {
            const result = await addContactToBrevo(retryMode ? 
              await supabase.auth.admin.getUserByEmail(email) : user)
            console.log(`✓ Synced user ${email} to Brevo (ID: ${result.id})`)
            successCount++
            
            // If successful in retry mode, remove from failed users set
            if (retryMode) {
              failedUsers.delete(email)
            }
          }
        } catch (error) {
          console.error(`✗ Failed to sync user ${email}:`, error.message)
          failureCount++
        }
        
        count++
        lastId = retryMode ? email : user.id
        
        // Add a small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Processed ${count} users so far (${successCount} succeeded, ${failureCount} failed)...`)

    } catch (error) {
      console.error('Batch processing error:', error)
      break
    }
  }

  return { successCount, failureCount }
}

// Run the sync
async function main() {
  console.log('Starting initial sync...')
  const initialResult = await syncUsersToBrevo()
  
  // If there were failures, offer to retry them
  if (failedUsers.size > 0) {
    console.log(`\n${failedUsers.size} users failed to sync. Retrying failed users...`)
    const retryResult = await syncUsersToBrevo(true)
    
    console.log('\nSync complete!')
    console.log('Initial sync:', initialResult)
    console.log('Retry results:', retryResult)
    
    if (failedUsers.size > 0) {
      console.log('\nUsers that still failed to sync:')
      failedUsers.forEach(email => console.log(email))
    }
  } else {
    console.log('\nSync complete!')
    console.log('Results:', initialResult)
  }
}

main().catch(console.error)