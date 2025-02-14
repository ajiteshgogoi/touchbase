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

// Types aligned with database schema
type NotificationWindow = typeof NOTIFICATION_WINDOWS[number];
type NotificationType = NotificationWindow['type'];
type NotificationStatus = 'success' | 'error' | 'invalid_token';

interface NotificationHistory {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  status: NotificationStatus;
  retry_count: number;
  sent_at: string;
  batch_id?: string;
  error_message?: string;
}

interface Profile {
  id: string;
  timezone: string | null;
}

interface PushSubscription {
  user_id: string;
  fcm_token: string;
}

interface UserWithNotifications extends PushSubscription {
  user_preferences: {
    timezone: string;
  };
  notification_history: NotificationHistory[];
}

// Match schema's notification_status enum
const NOTIFICATION_STATUSES = {
  SUCCESS: 'success' as NotificationStatus,
  ERROR: 'error' as NotificationStatus,
  INVALID_TOKEN: 'invalid_token' as NotificationStatus
};

// Window buffer in hours
const WINDOW_BUFFER_HOURS = 2;

// Maximum retry attempts per window period
const MAX_RETRY_ATTEMPTS = 3;

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
    const batchId = params.batchId;
    const isRetry = params.isRetry || false;
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

    // Get active push subscriptions with their preferences
    const { data: subscribedUsers, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, fcm_token')
      .not('fcm_token', 'is', null)
      .range(startIndex, startIndex + BATCH_SIZE - 1)
      .order('user_id', { ascending: true });

    if (subsError) throw subsError;
    if (!subscribedUsers?.length) {
      return new Response(
        JSON.stringify({ data: [], hasMore: false }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get their timezone preferences from user_preferences table
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('user_id, timezone')
      .in('user_id', subscribedUsers.map(u => u.user_id));

    if (prefError) throw prefError;

    // Create timezone map for quick lookup
    const timezoneMap = new Map(
      preferences?.map(p => [p.user_id, p.timezone || 'UTC']) || []
    );

    // Fetch notifications for these users
    let notificationQuery = supabase
      .from('notification_history')
      .select('*')
      .in('user_id', subscribedUsers.map(u => u.user_id))
      .gte('sent_at', oneDayAgo.toISOString());

    // Add retry-specific filters if this is a retry run
    if (isRetry) {
      notificationQuery = notificationQuery
        .eq('status', NOTIFICATION_STATUSES.ERROR)
        .lt('retry_count', MAX_RETRY_ATTEMPTS);
    }

    // Add final ordering
    const { data: notifications, error: notifyError } = await notificationQuery
      .order('sent_at', isRetry ? 'asc' : 'desc');

    if (notifyError) {
      console.error('Error fetching notifications:', {
        error: notifyError,
        details: notifyError.message
      });
      throw notifyError;
    }

    // Convert to extended user type with notifications
    const extendedUsers: UserWithNotifications[] = subscribedUsers.map(user => ({
      ...user,
      user_preferences: { timezone: timezoneMap.get(user.user_id) || 'UTC' },
      notification_history: (notifications || [])
        .filter(n => n.user_id === user.user_id)
        .map(n => ({
          ...n,
          status: n.status as NotificationStatus,
          notification_type: n.notification_type as NotificationType,
          retry_count: n.retry_count || 0
        }))
    }));

    // Calculate current hour in each user's timezone
    const userTimezones = new Map(
      extendedUsers.map(user => [
        user.user_id,
        {
          timezone: user.user_preferences.timezone,
          currentHour: new Date(now.toLocaleString('en-US', {
            timeZone: user.user_preferences.timezone
          })).getHours()
        }
      ])
    );

    // Only fetch due reminders for users who might need them
    const usersNeedingReminders = extendedUsers.filter(user => {
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
    const eligibleUsers = extendedUsers.reduce<Array<{userId: string, windowType: NotificationType}>>((acc, user) => {
      const userToday = new Date(now.toLocaleString('en-US', {
        timeZone: user.user_preferences.timezone
      }));
      const currentHour = userToday.getHours();
      
      // Filter notifications to today only and group by type
      const notificationsByType = new Map<NotificationType, NotificationHistory[]>();
      user.notification_history.forEach(n => {
        const notificationTime = new Date(n.sent_at);
        const userNotificationTime = new Date(notificationTime.toLocaleString('en-US', {
          timeZone: user.user_preferences.timezone
        }));
        userNotificationTime.setHours(0, 0, 0, 0);

        if (userNotificationTime.getTime() === userToday.getTime()) {
          const existing = notificationsByType.get(n.notification_type) || [];
          notificationsByType.set(n.notification_type, [...existing, n]);
        }
      });
      
      // Check each window
      NOTIFICATION_WINDOWS.forEach(window => {
        const hourDiff = (currentHour - window.hour + 24) % 24;
        
        // Only process if still within window period
        if (hourDiff <= WINDOW_BUFFER_HOURS) {
          // Get notifications for this window
          const windowNotifications = notificationsByType.get(window.type) || [];
          
          // Check notification status using schema-aligned constants
          const hasSuccess = windowNotifications.some(n => n.status === NOTIFICATION_STATUSES.SUCCESS);
          const hasError = windowNotifications.some(n => n.status === NOTIFICATION_STATUSES.ERROR);
          const totalAttempts = windowNotifications.length;

          // Only allow retries if:
          // 1. No successful notification
          // 2. Haven't reached max attempts
          // 3. Has error status (for retry runs)
          const canRetry = !hasSuccess &&
            totalAttempts < MAX_RETRY_ATTEMPTS &&
            (!isRetry || hasError);

          if (canRetry) {
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
    const params = req.method === 'POST' ? await req.json() : {};
    const batchId = params.batchId;

    console.error('Error in users function:', {
      error: error.message,
      stack: error.stack
    });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack,
        batchId 
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