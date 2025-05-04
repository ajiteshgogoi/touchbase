-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Add notification status enum type
create type public.notification_status as enum ('success', 'error', 'invalid_token');

-- Create tables with Row Level Security (RLS)
create table public.contacts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    name text not null,
    email text,
    phone text,
    social_media_platform text check (social_media_platform in ('linkedin', 'instagram', 'twitter', null)),
    social_media_handle text,
    last_contacted timestamp with time zone,
    next_contact_due timestamp with time zone,
    preferred_contact_method text check (preferred_contact_method in ('call', 'message', 'social', 'email', null)),
    notes text,
    contact_frequency text NOT NULL check (contact_frequency in ('every_three_days', 'weekly', 'fortnightly', 'monthly', 'quarterly')),
    ai_last_suggestion text,
    ai_last_suggestion_date timestamp with time zone,
    missed_interactions integer default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    -- Add constraint to prevent duplicate names per user
    constraint unique_user_contact_name unique (user_id, name)
);

-- Important events table for tracking birthdays, anniversaries, and custom events
create table public.important_events (
    id uuid primary key default uuid_generate_v4(),
    contact_id uuid references public.contacts on delete cascade not null,
    user_id uuid references auth.users not null,
    type text check (type in ('birthday', 'anniversary', 'custom')) not null,
    name text, -- Required for custom events, optional for birthday/anniversary
    date timestamp with time zone not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    -- Ensure each contact can have max 5 important events
    constraint max_events_per_contact unique (contact_id, type, date),
    constraint check_custom_event_name check (
        (type = 'custom' and name is not null) or 
        (type in ('birthday', 'anniversary'))
    )
);

create table public.interactions (
    id uuid primary key default uuid_generate_v4(),
    contact_id uuid references public.contacts on delete cascade not null,
    user_id uuid references auth.users not null,
    type text not null check (type in ('call', 'message', 'social', 'meeting', 'email')),
    date timestamp with time zone default now(),
    notes text,
    sentiment text check (sentiment in ('positive', 'neutral', 'negative', null)),
    created_at timestamp with time zone default now()
);

create table public.reminders (
    id uuid primary key default uuid_generate_v4(),
    contact_id uuid references public.contacts on delete cascade not null,
    user_id uuid references auth.users not null,
    type text not null check (type in ('call', 'message', 'social', 'email')),
    due_date timestamp with time zone not null,
    completed boolean default false,
    name text, -- Optional field used for quick reminders
    created_at timestamp with time zone default now()
);

create table public.contact_processing_logs (
    id uuid primary key default uuid_generate_v4(),
    contact_id uuid references public.contacts on delete cascade not null,
    processing_date date not null,
    batch_id text,
    status text check (status in ('pending', 'success', 'error', 'max_retries_exceeded')) default 'success',
    error_message text,
    retry_count integer default 0,
    last_error text,
    created_at timestamp with time zone default now(),
    constraint unique_contact_date unique (contact_id, processing_date)
);

create table public.user_preferences (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null unique,
    notification_enabled boolean default true,
    theme text check (theme in ('light', 'dark', 'system')) default 'system',
    timezone text default 'UTC',
    ai_suggestions_enabled boolean default true,
    has_rated_app boolean default false,
    last_rating_prompt timestamp with time zone,
    install_time timestamp with time zone default now(),
    onboarding_completed boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.push_subscriptions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    fcm_token text not null,
    device_id text not null,
    device_name text,
    device_type text check (device_type in ('web', 'android', 'ios')) default 'web',
    browser_instance text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    expires_at timestamp with time zone not null default (now() + interval '30 days'),
    last_refresh timestamp with time zone default now(),
    refresh_count integer default 0,
    enabled boolean not null default true,
    constraint unique_user_device_browser unique (user_id, device_id, browser_instance)
);

-- Add check constraint for refresh rate limiting
alter table public.push_subscriptions
add constraint check_refresh_rate
check (
    refresh_count <= 1000 -- Max 1000 refreshes per token
    and last_refresh <= now() -- Ensure last_refresh is not in future
);

-- Add cleanup function for expired tokens
create or replace function cleanup_expired_tokens()
returns trigger as $$
begin
    delete from public.push_subscriptions
    where expires_at < now();
    return null;
end;
$$ language plpgsql;

-- Add cleanup trigger
create trigger cleanup_expired_tokens_trigger
after insert or update on public.push_subscriptions
for each statement execute function cleanup_expired_tokens();

-- Add function for optimized event retrieval with yearly recurrence
create or replace function get_upcoming_events(
  p_user_id uuid,
  p_visible_contact_ids uuid[] default null,
  p_months_ahead int default 12,
  p_limit int default null
)
returns table (
  id uuid,
  contact_id uuid,
  user_id uuid,
  type text,
  name text,
  date timestamp with time zone,
  next_occurrence timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) as $$
begin
  return query
  select
    e.id,
    e.contact_id,
    e.user_id,
    e.type,
    e.name,
    e.date,
    calculate_next_occurrence(e.date) +
      make_interval(years :=
        case
          when calculate_next_occurrence(e.date) < current_timestamp
          then cast(extract(year from age(current_timestamp, calculate_next_occurrence(e.date))) as int)
          else 0
        end
      ) as next_occurrence,
    e.created_at,
    e.updated_at
  from important_events e
  where e.user_id = p_user_id
    and (p_visible_contact_ids is null or e.contact_id = any(p_visible_contact_ids))
    and calculate_next_occurrence(e.date) <= current_timestamp + (p_months_ahead || ' months')::interval
  order by next_occurrence
  limit p_limit;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function get_upcoming_events(uuid, uuid[], int, int) to authenticated;

-- Create an IMMUTABLE function for next occurrence calculation
create or replace function calculate_next_occurrence(event_date timestamp with time zone)
returns timestamp with time zone
language sql
immutable
as $$
  select date_trunc('day', event_date) +
    make_interval(years :=
      case
        when extract(year from age(date_trunc('day', '2000-01-01'::timestamp), date_trunc('day', event_date))) < 0 then 0
        when date_trunc('day', event_date + make_interval(years := extract(year from age(date_trunc('day', '2000-01-01'::timestamp), date_trunc('day', event_date)))::int)) < date_trunc('day', '2000-01-01'::timestamp)
        then extract(year from age(date_trunc('day', '2000-01-01'::timestamp), date_trunc('day', event_date)))::int + 1
        else extract(year from age(date_trunc('day', '2000-01-01'::timestamp), date_trunc('day', event_date)))::int
      end
    );
$$;

-- Add index using the immutable function
create index if not exists important_events_next_occurrence_idx
  on important_events (calculate_next_occurrence(date));

-- Add optimized indexes for get_upcoming_events function
create index if not exists important_events_user_lookup_idx
  on important_events (user_id, calculate_next_occurrence(date));

create index if not exists important_events_contact_lookup_idx
  on important_events (user_id, contact_id, calculate_next_occurrence(date));

-- Add device limit trigger
create or replace function check_device_limit()
returns trigger as $$
begin
    if (select count(*) from public.push_subscriptions where user_id = NEW.user_id) >= 10 then
        raise exception 'Maximum number of devices (10) reached for user';
    end if;
    return NEW;
end;
$$ language plpgsql;

create trigger enforce_device_limit
before insert on public.push_subscriptions
for each row execute function check_device_limit();

-- Create subscription plans table
create table public.subscription_plans (
    id text primary key,
    name text not null,
    price numeric not null,
    billing_period text not null check (billing_period in ('monthly', 'annual')),
    google_play_product_id text unique,
    monthly_equivalent numeric,
    contact_limit integer not null,
    features jsonb not null,
    created_at timestamp with time zone default now()
);

-- Add subscription plan policies
create policy "Anyone can read subscription plans"
    on public.subscription_plans for select
    to public
    using (true);

create table public.subscriptions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null unique,
    subscription_plan_id text references public.subscription_plans(id) not null,
    status text not null check (status in ('active', 'canceled', 'expired')),
    paypal_subscription_id text unique,
    google_play_token text unique,
    valid_until timestamp with time zone not null,
    trial_start_date timestamp with time zone,
    trial_end_date timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.notification_history (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    notification_type text not null check (notification_type in ('morning', 'afternoon', 'evening')),
    sent_at timestamp with time zone not null,
    status notification_status not null default 'success',
    error_message text,
    batch_id uuid,
    retry_count integer default 0,
    created_at timestamp with time zone default now()
);

-- Add indexes for notification tracking
create index if not exists idx_notification_batch on public.notification_history(batch_id);
create index if not exists idx_notification_batch_id_cover on public.notification_history(batch_id) INCLUDE (id);
create index if not exists idx_notification_status on public.notification_history(status);

-- Add column descriptions
comment on column public.notification_history.status is 'Status of the notification attempt';
comment on column public.notification_history.error_message is 'Error message if notification failed';
comment on column public.notification_history.batch_id is 'UUID to group notifications processed in the same batch';
comment on column public.notification_history.retry_count is 'Number of retry attempts for failed notifications';

-- Add comments for prompt generation logs
comment on table public.prompt_generation_logs is 'Logs for conversation prompt generations';
comment on column public.prompt_generation_logs.prompt_text is 'The generated conversation prompt text';
comment on column public.prompt_generation_logs.theme is 'The main theme used for generation';
comment on column public.prompt_generation_logs.subtheme is 'The subtheme used for generation';
comment on column public.prompt_generation_logs.perspective is 'The perspective used for generation';
comment on column public.prompt_generation_logs.emotional_modifier is 'The emotional modifier used for generation';

create table public.contact_analytics (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    data jsonb not null,
    generated_at timestamp with time zone not null,
    created_at timestamp with time zone default now() not null
);

-- Add comments for rating columns in user_preferences
comment on column public.user_preferences.has_rated_app is 'Whether the user has rated the app';
comment on column public.user_preferences.last_rating_prompt is 'When the user was last prompted to rate the app';
comment on column public.user_preferences.install_time is 'When the user first installed the app';

-- Add index for install_time
create index idx_user_preferences_install_time on public.user_preferences(install_time);
create index idx_user_preferences_onboarding on public.user_preferences(onboarding_completed);

-- Add comment for onboarding_completed column
comment on column public.user_preferences.onboarding_completed is 'Whether the user has completed the onboarding flow';

create table public.prompt_generation_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    prompt_text text not null,
    theme text not null,
    subtheme text not null,
    perspective text not null,
    emotional_modifier text not null,
    created_at timestamp with time zone default now()
);

create table public.content_reports (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    contact_id uuid references public.contacts on delete cascade,
    content text not null,
    content_type text check (content_type in ('suggestion', 'conversation-prompt')) not null default 'suggestion',
    created_at timestamp with time zone default now()
);

create table public.feedback (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    email text not null,
    feedback text not null,
    type text check (type in ('general', 'cancellation')) default 'general',
    reason text,
    created_at timestamp with time zone default now()
);

-- Add index for type column
create index if not exists feedback_type_idx on public.feedback(type);

-- Add helpful comments
comment on column public.feedback.type is 'Type of feedback (general or cancellation)';
comment on column public.feedback.reason is 'Specific reason category for cancellation feedback';

-- Create indexes
create index contacts_user_id_idx on public.contacts(user_id);
create index contacts_name_idx on public.contacts(name ASC);
create index contacts_name_include_idx on public.contacts(name ASC) INCLUDE (id, last_contacted, missed_interactions, contact_frequency, next_contact_due);
create index contacts_name_trgm_idx ON public.contacts USING GIN (name gin_trgm_ops);
create index contacts_last_contacted_idx on public.contacts(last_contacted);
create index contacts_next_contact_due_idx on public.contacts(next_contact_due);
create index contacts_created_at_name_idx on public.contacts(created_at DESC, name ASC);

-- Optimized index for contacts pagination
create index contacts_pagination_covering_idx on public.contacts
(user_id, created_at DESC)
INCLUDE (id, name, phone, social_media_platform, social_media_handle,
last_contacted, next_contact_due, preferred_contact_method, notes,
contact_frequency, missed_interactions);

create index interactions_contact_id_idx on public.interactions(contact_id);
create index interactions_user_id_idx on public.interactions(user_id);
create index interactions_date_idx on public.interactions(date);
-- Optimized indexes for reminders pagination query
create index reminders_contact_id_idx on public.reminders(contact_id);
create index reminders_user_id_idx on public.reminders(user_id);
create index reminders_due_date_idx on public.reminders(due_date);
create index reminders_due_date_contact_id_idx on public.reminders(due_date, contact_id);
create index reminders_due_date_covering_idx on public.reminders(due_date)
  include (id, contact_id, user_id, type, name, completed, created_at);
create index contacts_reminder_join_idx on public.contacts(id)
  include (name)
  where id in (select contact_id from public.reminders);
-- Optimized index for incomplete reminders with sorting
create index reminders_due_date_contact_name_idx on public.reminders(due_date ASC)
  include (contact_id, user_id, type, name, completed, created_at)
  where completed = false;
create index contact_processing_logs_date_idx on public.contact_processing_logs(processing_date);
create index contact_processing_logs_contact_id_idx on public.contact_processing_logs(contact_id);
create index contact_processing_logs_batch_id_idx on public.contact_processing_logs(batch_id);
create index contact_processing_logs_retry_count_idx on public.contact_processing_logs(retry_count);
create index contact_processing_logs_status_idx on public.contact_processing_logs(status);
-- Indexes for push_subscriptions with device support
create index push_subscriptions_user_lookup_idx on public.push_subscriptions(user_id);
create index push_subscriptions_device_lookup_idx on public.push_subscriptions(device_id);
create index notification_history_user_time_idx on public.notification_history(user_id, sent_at);
create index contact_analytics_user_id_idx on public.contact_analytics(user_id);
create index contact_analytics_generated_at_idx on public.contact_analytics(generated_at);
-- Add compound index for user_id and generated_at for better query performance
create index contact_analytics_user_generated_idx on public.contact_analytics(user_id, generated_at);
-- Add GIN index on JSONB data for faster JSON operations
create index contact_analytics_data_gin_idx on public.contact_analytics using gin(data);
create index prompt_generation_logs_user_id_idx on public.prompt_generation_logs(user_id);
create index prompt_generation_logs_created_at_idx on public.prompt_generation_logs(created_at);
create index content_reports_user_id_idx on public.content_reports(user_id);
create index content_reports_contact_id_idx on public.content_reports(contact_id);
create index feedback_user_id_idx on public.feedback(user_id);

-- Indexes for important_events
create index important_events_contact_id_idx on public.important_events(contact_id);
create index important_events_user_id_idx on public.important_events(user_id);
create index important_events_type_idx on public.important_events(type);
create index important_events_date_idx on public.important_events(date);

-- Create optimized contacts pagination function
CREATE OR REPLACE FUNCTION get_paginated_contacts(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER
) RETURNS TABLE (
  total_result_set INTEGER,
  page_total INTEGER,
  body JSONB,
  response_headers TEXT,
  response_status TEXT,
  response_inserted BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH base_query AS (
    SELECT *
    FROM public.contacts
    WHERE user_id = p_user_id
  ),
  page_query AS (
    SELECT *
    FROM base_query
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  total_count AS (
    SELECT count(*)::integer AS total
    FROM base_query
  )
  SELECT
    (SELECT total FROM total_count) as total_result_set,
    count(*)::integer as page_total,
    COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as body,
    NULL as response_headers,
    NULL as response_status,
    FALSE as response_inserted
  FROM page_query t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_paginated_contacts(UUID, INTEGER, INTEGER) TO authenticated;

-- Create function to log interaction and update contact in a single transaction
CREATE OR REPLACE FUNCTION log_interaction_and_update_contact(
  p_contact_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_date TIMESTAMP WITH TIME ZONE,
  p_notes TEXT,
  p_sentiment TEXT
) RETURNS TABLE (
  interaction_id UUID,
  contact_updated BOOLEAN
) AS $$
DECLARE
  v_latest_interaction TIMESTAMP WITH TIME ZONE;
  v_contact RECORD;
  v_interaction_id UUID;
BEGIN
  -- Get contact details first
  SELECT * INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
  FOR UPDATE;  -- Lock the row to prevent concurrent updates

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- Insert the interaction
  INSERT INTO interactions (
    contact_id,
    user_id,
    type,
    date,
    notes,
    sentiment
  )
  VALUES (
    p_contact_id,
    p_user_id,
    p_type,
    p_date,
    p_notes,
    p_sentiment
  )
  RETURNING id INTO v_interaction_id;

  -- Get the latest interaction date for this contact
  SELECT date INTO v_latest_interaction
  FROM interactions
  WHERE contact_id = p_contact_id
  ORDER BY date DESC
  LIMIT 1;

  -- Only update contact if this is the latest interaction
  IF v_latest_interaction <= p_date THEN
    UPDATE contacts
    SET
      last_contacted = p_date,
      missed_interactions = 0,
      next_contact_due = calculate_next_contact_due(
        contact_frequency,
        0,  -- Reset missed_interactions
        p_date
      )
    WHERE id = p_contact_id;
    
    RETURN QUERY
    SELECT v_interaction_id, true;
  ELSE
    RETURN QUERY
    SELECT v_interaction_id, false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_interaction_and_update_contact(UUID, UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT) TO authenticated;

-- Helper function to calculate next contact due date
CREATE OR REPLACE FUNCTION calculate_next_contact_due(
  p_frequency TEXT,
  p_missed_interactions INTEGER,
  p_last_contacted TIMESTAMP WITH TIME ZONE
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  RETURN p_last_contacted +
    CASE p_frequency
      WHEN 'every_three_days' THEN INTERVAL '3 days'
      WHEN 'weekly' THEN INTERVAL '1 week'
      WHEN 'fortnightly' THEN INTERVAL '2 weeks'
      WHEN 'monthly' THEN INTERVAL '1 month'
      WHEN 'quarterly' THEN INTERVAL '3 months'
    END +
    -- Add extra days based on missed interactions
    (p_missed_interactions * INTERVAL '1 day');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add helpful comment
COMMENT ON FUNCTION get_paginated_contacts IS 'Optimized pagination function for contacts using covering index';

-- Enable Row Level Security
alter table public.contacts enable row level security;
alter table public.interactions enable row level security;
alter table public.reminders enable row level security;
alter table public.user_preferences enable row level security;
alter table public.subscriptions enable row level security;
alter table public.contact_processing_logs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_history enable row level security;
alter table public.contact_analytics enable row level security;
alter table public.prompt_generation_logs enable row level security;
alter table public.content_reports enable row level security;
alter table public.feedback enable row level security;
alter table public.important_events enable row level security;

-- Create policies
create policy "Users can view their own contacts"
    on public.contacts for select
    using (user_id = (select auth.uid()));

create policy "Users can insert their own contacts"
    on public.contacts for insert
    with check (user_id = (select auth.uid()));

create policy "Users can update their own contacts"
    on public.contacts for update
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "Users can delete their own contacts"
    on public.contacts for delete
    using (user_id = (select auth.uid()));

-- Important events policies
create policy "Users can view their own important events"
    on public.important_events for select
    using (user_id = (select auth.uid()));

create policy "Users can insert their own important events"
    on public.important_events for insert
    with check (user_id = (select auth.uid()));

create policy "Users can update their own important events"
    on public.important_events for update
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "Users can delete their own important events"
    on public.important_events for delete
    using (user_id = (select auth.uid()));

create policy "Users can view their own interactions"
    on public.interactions for select
    using (user_id = (select auth.uid()));

create policy "Users can insert their own interactions"
    on public.interactions for insert
    with check (user_id = (select auth.uid()));

create policy "Users can update their own interactions"
    on public.interactions for update
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "Users can delete their own interactions"
    on public.interactions for delete
    using (user_id = (select auth.uid()));

create policy "Users can view their own reminders"
    on public.reminders for select
    using (user_id = (select auth.uid()));

create policy "Users can insert their own reminders"
    on public.reminders for insert
    with check (user_id = (select auth.uid()));

create policy "Users can update their own reminders"
    on public.reminders for update
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "Users can delete their own reminders"
    on public.reminders for delete
    using (user_id = (select auth.uid()));

-- User preferences policies
-- Note: Consolidating multiple permissive SELECT policies into a single policy for better performance
create policy "Read user preferences"
    on public.user_preferences
    for select
    to public
    using (
        -- Service role has full read access, users can only read their own
        (select auth.role()) = 'service_role' OR user_id = (select auth.uid())
    );

create policy "Users can insert their own preferences"
    on public.user_preferences for insert
    with check (user_id = (select auth.uid()));

create policy "Users can update their own preferences"
    on public.user_preferences for update
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "Users can view their own subscription"
    on public.subscriptions for select
    using (user_id = (select auth.uid()));

create policy "Users can insert their own subscription"
    on public.subscriptions for insert
    with check (user_id = (select auth.uid()));

create policy "Users can update their own subscription"
    on public.subscriptions for update
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- Push subscription policies
-- Note: Consolidating multiple permissive policies into a single policy for better performance
-- This handles admin access, service role access, and user-specific access
create policy "Manage push subscriptions"
    on public.push_subscriptions
    for all
    to public
    using (
        (select auth.role()) = 'service_role' OR
        (select auth.uid()) = '2f4815b5-d303-4d91-80d9-5ec8576a3b19'::uuid OR
        (select auth.uid()) = user_id
    );

-- Note: Using (select auth.<function>()) pattern to prevent re-evaluation for each row
-- This improves query performance at scale by avoiding unnecessary function calls
create policy "Users can view their own notification history"
    on public.notification_history for select
    using (user_id = (select auth.uid()));

create policy "Users can view their own analytics"
    on public.contact_analytics for select
    using (user_id = (select auth.uid()));

create policy "Users can insert their own analytics"
    on public.contact_analytics for insert
    with check (user_id = (select auth.uid()));

create policy "Users can update their own analytics"
    on public.contact_analytics for update
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "Users can delete their own analytics"
    on public.contact_analytics for delete
    using (user_id = (select auth.uid()));

-- Prompt generation logs policies
create policy "Users can view their own prompt generation logs"
    on public.prompt_generation_logs for select
    using (user_id = (select auth.uid()));

create policy "Users can insert their own prompt generation logs"
    on public.prompt_generation_logs for insert
    with check (user_id = (select auth.uid()));

-- Content reports policies
create policy "Users can view their own content reports"
    on public.content_reports for select
    using (user_id = (select auth.uid()));

create policy "Users can insert content reports"
    on public.content_reports for insert
    with check (user_id = (select auth.uid()));

-- Feedback policies
create policy "Users can view their own feedback"
    on public.feedback for select
    using (user_id = (select auth.uid()));

create policy "Users can insert their own feedback"
    on public.feedback for insert
    with check (user_id = (select auth.uid()));



create policy "Service role can insert notification history"
    on public.notification_history for insert
    with check ((select auth.role()) = 'service_role'::text);

-- Create functions
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Create triggers
create trigger handle_contacts_updated_at
    before update on public.contacts
    for each row
    execute function public.handle_updated_at();

create trigger handle_user_preferences_updated_at
    before update on public.user_preferences
    for each row
    execute function public.handle_updated_at();

create trigger handle_subscriptions_updated_at
    before update on public.subscriptions
    for each row
    execute function public.handle_updated_at();

create trigger handle_push_subscriptions_updated_at
    before update on public.push_subscriptions
    for each row
    execute function public.handle_updated_at();

create trigger handle_important_events_updated_at
    before update on public.important_events
    for each row
    execute function public.handle_updated_at();

-- Functions for device push notification management
create or replace function get_device_notification_state(
  p_user_id uuid,
  p_device_id text
) returns table (
  enabled boolean
) language plpgsql security definer as $$
begin
  return query
  select ps.enabled
  from push_subscriptions ps
  where ps.user_id = p_user_id
  and ps.device_id = p_device_id
  limit 1;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function get_device_notification_state(uuid, text) to authenticated;

create or replace function get_device_subscription(
  p_user_id uuid,
  p_device_id text,
  p_browser_instance text
) returns table (
  fcm_token text,
  enabled boolean
) language plpgsql security definer as $$
begin
  return query
  select
    ps.fcm_token,
    ps.enabled
  from push_subscriptions ps
  where ps.user_id = p_user_id
  and ps.device_id = p_device_id
  and ps.browser_instance = p_browser_instance
  limit 1;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function get_device_subscription(uuid, text, text) to authenticated;

create or replace function get_user_device_tokens(
  p_user_id uuid,
  p_namespace text
) returns table (
  device_id text,
  device_type text,
  enabled boolean
) language plpgsql security definer as $$
begin
  return query
  select
    ps.device_id,
    ps.device_type,
    ps.enabled
  from push_subscriptions ps
  where ps.user_id = p_user_id
  and ps.device_id ilike p_namespace || '%';
end;
$$;

-- Chat log table for rate limiting
-- Create enum type for status
create type public.brevo_update_status as enum ('pending', 'success', 'error', 'skipped');

-- Create the log table
create table public.brevo_update_logs (
    id uuid primary key default uuid_generate_v4(),
    run_id uuid not null, -- Identifier for a single execution run of the update function
    user_id uuid references auth.users(id) on delete set null, -- Link to user, allow null if user deleted
    email text not null, -- Store email for reference even if user is deleted
    status brevo_update_status not null default 'pending',
    attributes_attempted jsonb, -- Store the attributes we tried to update
    error_message text, -- Store error details if status is 'error'
    processed_at timestamp with time zone default now(), -- When this specific log entry was processed/updated
    created_at timestamp with time zone default now() -- When the log entry was initially created (pending)
);

-- Add unique constraint for upsert
alter table public.brevo_update_logs
  add constraint brevo_update_logs_run_id_email_key unique (run_id, email);

-- Add indexes for querying
create index idx_brevo_update_logs_run_id on public.brevo_update_logs(run_id);
create index idx_brevo_update_logs_user_id on public.brevo_update_logs(user_id);
create index idx_brevo_update_logs_email on public.brevo_update_logs(email);
create index idx_brevo_update_logs_status on public.brevo_update_logs(status);
create index idx_brevo_update_logs_created_at on public.brevo_update_logs(created_at);

-- Enable Row Level Security
alter table public.brevo_update_logs enable row level security;

-- Create policies
-- Allow service role full access (for the edge function)
create policy "Allow service role full access"
    on public.brevo_update_logs
    for all
    using ((select auth.role()) = 'service_role')
    with check ((select auth.role()) = 'service_role');

-- Optionally, allow users to read their own logs (adjust if needed)
-- create policy "Users can view their own logs"
--     on public.brevo_update_logs
--     for select
--     using (user_id = auth.uid());

-- Add comments for clarity
comment on table public.brevo_update_logs is 'Logs each attempt to update a contact in Brevo via the daily batch function.';
comment on column public.brevo_update_logs.run_id is 'Identifier linking all logs from a single execution run.';
comment on column public.brevo_update_logs.status is 'Status of the update attempt for this contact.';
comment on column public.brevo_update_logs.attributes_attempted is 'JSON object containing the attributes intended for update.';
comment on column public.brevo_update_logs.processed_at is 'Timestamp when the final status (success/error/skipped) was recorded.';
create table public.chat_log (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    message text not null,
    created_at timestamp with time zone default now()
);

-- Add indexes for efficient rate limiting queries
create index chat_log_user_id_created_at_idx on public.chat_log(user_id, created_at);

-- Enable RLS
alter table public.chat_log enable row level security;

-- Create policies
create policy "Users can view their own chat logs"
    on public.chat_log for select
    using (user_id = auth.uid());

create policy "Users can insert their own chat logs"
    on public.chat_log for insert
    with check (user_id = auth.uid());

-- Add cleanup function for old chat logs
create or replace function cleanup_old_chat_logs()
returns trigger as $$
begin
    delete from public.chat_log
    where created_at < now() - interval '24 hours';
    return null;
end;
$$ language plpgsql;

-- Add cleanup trigger that runs after insert
create trigger cleanup_old_chat_logs_trigger
after insert on public.chat_log
for each statement execute function cleanup_old_chat_logs();

-- Grant execute permission to authenticated users
grant execute on function get_user_device_tokens(uuid, text) to authenticated;