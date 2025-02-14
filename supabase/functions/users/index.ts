/**
 * Push Notification User Eligibility Service
 * 
 * This service determines which users should receive push notifications based on:
 * - Their current time window (morning/afternoon/evening)
 * - Their timezone-specific time
 * - Their due reminders status (required for afternoon/evening)
 * - Their previous notification history
 * 
 * Uses batch processing for scalability:
 * - Tracks notifications by batch_id to prevent duplicates
 * - Supports pagination for handling large user bases
 * - Uses database-level joins to minimize queries
 * - Filters users early to reduce processing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Notification window configuration
const NOTIFICATION_WINDOWS = [
  { type: 'morning', hour: 9, requiresDueReminders: false },
  { type: 'afternoon', hour: 14, requiresDueReminders: true },
  { type: 'evening', hour: 19, requiresDueReminders: true }
] as const;

type NotificationWindow = typeof NOTIFICATION_WINDOWS[number];
type NotificationType = NotificationWindow['type'];

// Window buffer in hours
const WINDOW_BUFFER_HOURS = 2;

// Match workflow batch size
const BATCH_SIZE = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Authorization',
      },
    });
  }

  try {
    const params = req.method === 'POST' ? await req.json() : {};
    const page = params.page || 0;
    const batchId = params.batchId; // Required batch ID from workflow
    const startIndex = page * BATCH_SIZE;
    
    if (!batchId) {
      return new Response(
        JSON.stringify({ error: 'Missing batch ID' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Starting notification eligibility check', {
      page,
      batchSize: BATCH_SIZE,
      startIndex,
      batchId
    });
    
    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    // First verify this batch hasn't been processed
    const { data: existingNotifications, error: batchError } = await supabase
      .from('notification_history')
      .select('id')
      .eq('batch_id', batchId)
      .limit(1);

    if (batchError) {
      throw batchError;
    }

    if (existingNotifications?.length > 0) {
      console.log('Batch already processed:', { batchId });
      return new Response(
        JSON.stringify({ 
          data: [],
          hasMore: false,
          message: 'Batch already processed'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get users with their preferences, excluding those already notified in the current batch
    const { data: subscribedUsers, error: subsError } = await supabase
      .from('push_subscriptions')
      .select(`
        user_id,
        fcm_token,
        user_preferences (
          timezone
        ),
        notification_history!inner (
          notification_type,
          status,
          retry_count,
          sent_at
        )
      `)
      .not('fcm_token', 'is', null)
      .not('notification_history.batch_id', 'eq', batchId)
      .range(startIndex, startIndex + BATCH_SIZE - 1);

    if (subsError) {
      console.error('Error fetching subscribed users:', {
        error: subsError,
        details: subsError.message
      });
      throw subsError;
    }

    if (!subscribedUsers?.length) {
      console.log('No more subscribed users to process');
      return new Response(
        JSON.stringify({ data: [], hasMore: false }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing batch of users:', {
      batchSize: subscribedUsers.length,
      page,
      batchId
    });

    // Calculate current hour in each user's timezone
    const userTimezones = new Map(
      subscribedUsers.map(user => [
        user.user_id,
        {
          timezone: user.user_preferences?.timezone || 'UTC',
          currentHour: new Date(now.toLocaleString('en-US', {
            timeZone: user.user_preferences?.timezone || 'UTC'
          })).getHours()
        }
      ])
    );

    // Only fetch due reminders for users who might need them
    const usersNeedingReminders = subscribedUsers.filter(user => {
      const { currentHour } = userTimezones.get(user.user_id)!;
      return NOTIFICATION_WINDOWS.some(window => {
        const hourDiff = (currentHour - window.hour + 24) % 24;
        return hourDiff <= WINDOW_BUFFER_HOURS && window.requiresDueReminders;
      });
    });

    const dueRemindersMap = new Map<string, number>();
    
    if (usersNeedingReminders.length > 0) {
      console.log('Fetching due reminders for filtered users:', {
        userCount: usersNeedingReminders.length
      });

      const { data: dueReminders, error: remindersError } = await supabase
        .from('reminders')
        .select('user_id, due_date')
        .in('user_id', usersNeedingReminders.map(u => u.user_id))
        .eq('completed', false);

      if (remindersError) {
        console.error('Error fetching due reminders:', {
          error: remindersError,
          details: remindersError.message
        });
        throw remindersError;
      }

      // Process due reminders in user's timezone
      dueReminders?.forEach(reminder => {
        const { timezone } = userTimezones.get(reminder.user_id)!;
        const userToday = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        userToday.setHours(0, 0, 0, 0);
        
        const dueDate = new Date(reminder.due_date);
        const userDueDate = new Date(dueDate.toLocaleString('en-US', { timeZone: timezone }));
        userDueDate.setHours(0, 0, 0, 0);
        
        if (userDueDate <= userToday) {
          dueRemindersMap.set(
            reminder.user_id,
            (dueRemindersMap.get(reminder.user_id) || 0) + 1
          );
        }
      });

      console.log('Due reminders processed:', {
        usersWithDue: dueRemindersMap.size
      });
    }

    // Determine eligible users
    const eligibleUsers = subscribedUsers.reduce<Array<{userId: string, windowType: NotificationType}>>((acc, user) => {
      const { currentHour } = userTimezones.get(user.user_id)!;
      
      // Group notifications by type for efficient lookup
      const notificationsByType = new Map<NotificationType, typeof user.notification_history>();
      user.notification_history.forEach(n => {
        const existing = notificationsByType.get(n.notification_type as NotificationType) || [];
        notificationsByType.set(n.notification_type as NotificationType, [...existing, n]);
      });
      
      // Check each window
      NOTIFICATION_WINDOWS.forEach(window => {
        const hourDiff = (currentHour - window.hour + 24) % 24;
        if (hourDiff <= WINDOW_BUFFER_HOURS) {
          // Get notifications for this window
          const windowNotifications = notificationsByType.get(window.type) || [];
          
          // Skip if already notified or max retries reached
          const hasSuccess = windowNotifications.some(n => n.status === 'success');
          const hasMaxRetries = windowNotifications.some(n => n.retry_count >= 2);

          if (!hasSuccess && !hasMaxRetries) {
            // For windows requiring due reminders, check count
            if (!window.requiresDueReminders || dueRemindersMap.get(user.user_id) > 0) {
              acc.push({
                userId: user.user_id,
                windowType: window.type
              });
            }
          }
        }
      });

      return acc;
    }, []);

    console.log('Batch processing completed:', {
      batchId,
      batchSize: subscribedUsers.length,
      eligible: eligibleUsers.length,
      hasMore: subscribedUsers.length === BATCH_SIZE
    });

    return new Response(
      JSON.stringify({
        data: eligibleUsers,
        hasMore: subscribedUsers.length === BATCH_SIZE,
        batchId
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error) {
    console.error('Error in users function:', {
      error: error.message,
      stack: error.stack
    });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});