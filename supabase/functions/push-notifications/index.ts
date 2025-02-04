import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getDueRemindersCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', false)
    .lte('due_date', today.toISOString());

  if (error) {
    console.error('Error fetching reminders:', error);
    return 0;
  }

  return reminders?.length || 0;
}

async function getUserTimeAndSubscription(userId: string) {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('timezone, username')
    .eq('id', userId)
    .single();

  if (userError) {
    throw new Error('Error fetching user data');
  }

  const { data: subscription, error: subError } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single();

  if (subError) {
    throw new Error('Error fetching subscription');
  }

  return {
    timezone: userData?.timezone || 'UTC',
    username: userData?.username || 'User',
    subscription: subscription?.subscription
  };
}

function shouldSendNotification(userTime: Date): boolean {
  const hour = userTime.getHours();
  return hour === 9 || hour === 14 || hour === 19;
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
      });
    }

    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
      throw new Error('Missing VAPID keys');
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user ID' }),
        { status: 400 }
      );
    }

    const { timezone, username, subscription } = await getUserTimeAndSubscription(userId);
    const userTime = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));

    // Only send notifications at specific hours
    if (!shouldSendNotification(userTime)) {
      return new Response(
        JSON.stringify({ message: 'Not notification time' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dueCount = await getDueRemindersCount(userId);
    
    // Only send afternoon and evening notifications if there are due reminders
    const currentHour = userTime.getHours();
    if ((currentHour === 14 || currentHour === 19) && dueCount === 0) {
      return new Response(
        JSON.stringify({ message: 'No due reminders' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    webPush.setVapidDetails(
      'mailto:admin@touchbase.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const notificationPayload = {
      title: 'TouchBase Reminder',
      body: `Hi ${username}, you have ${dueCount} interaction${dueCount === 1 ? '' : 's'} due today! Update here if done.`,
      url: '/reminders'
    };

    if (subscription) {
      await webPush.sendNotification(
        subscription,
        JSON.stringify(notificationPayload)
      );
    }

    return new Response(
      JSON.stringify({ message: 'Notification sent successfully' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});