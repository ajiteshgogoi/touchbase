import { serve } from "std/http/server"

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const { subscription, title, body } = await req.json()

    if (!subscription || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      )
    }

    const webpush = await import('web-push')
    
    webpush.setVapidDetails(
      'mailto:your-email@example.com', // Replace with your email
      VAPID_PUBLIC_KEY!,
      VAPID_PRIVATE_KEY!
    )

    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body })
    )

    return new Response(
      JSON.stringify({ message: 'Notification sent successfully' }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})