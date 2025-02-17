-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Add notification status enum type
create type public.notification_status as enum ('success', 'error', 'invalid_token');

-- Create tables with Row Level Security (RLS)
create table public.contacts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    name text not null,
    phone text,
    social_media_handle text,
    last_contacted timestamp with time zone,
    next_contact_due timestamp with time zone,
    preferred_contact_method text check (preferred_contact_method in ('call', 'message', 'social', null)),
    notes text,
    relationship_level integer check (relationship_level between 1 and 5),
    contact_frequency text check (contact_frequency in ('daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', null)),
    ai_last_suggestion text,
    ai_last_suggestion_date timestamp with time zone,
    missed_interactions integer default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.interactions (
    id uuid primary key default uuid_generate_v4(),
    contact_id uuid references public.contacts on delete cascade not null,
    user_id uuid references auth.users not null,
    type text not null check (type in ('call', 'message', 'social', 'meeting')),
    date timestamp with time zone default now(),
    notes text,
    sentiment text check (sentiment in ('positive', 'neutral', 'negative', null)),
    created_at timestamp with time zone default now()
);

create table public.reminders (
    id uuid primary key default uuid_generate_v4(),
    contact_id uuid references public.contacts on delete cascade not null,
    user_id uuid references auth.users not null,
    type text not null check (type in ('call', 'message', 'social')),
    due_date timestamp with time zone not null,
    completed boolean default false,
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
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.push_subscriptions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null unique,
    fcm_token text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table public.subscriptions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null unique,
    plan_id text not null check (plan_id in ('free', 'premium')),
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
create index if not exists idx_notification_status on public.notification_history(status);

-- Add column descriptions
comment on column public.notification_history.status is 'Status of the notification attempt';
comment on column public.notification_history.error_message is 'Error message if notification failed';
comment on column public.notification_history.batch_id is 'UUID to group notifications processed in the same batch';
comment on column public.notification_history.retry_count is 'Number of retry attempts for failed notifications';

create table public.contact_analytics (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    data jsonb not null,
    generated_at timestamp with time zone not null,
    created_at timestamp with time zone default now() not null
);

create table public.content_reports (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    contact_id uuid references public.contacts on delete cascade not null,
    content text not null,
    created_at timestamp with time zone default now()
);

-- Create indexes
create index contacts_user_id_idx on public.contacts(user_id);
create index contacts_last_contacted_idx on public.contacts(last_contacted);
create index contacts_next_contact_due_idx on public.contacts(next_contact_due);
create index interactions_contact_id_idx on public.interactions(contact_id);
create index interactions_user_id_idx on public.interactions(user_id);
create index interactions_date_idx on public.interactions(date);
create index reminders_contact_id_idx on public.reminders(contact_id);
create index reminders_user_id_idx on public.reminders(user_id);
create index reminders_due_date_idx on public.reminders(due_date);
create index contact_processing_logs_date_idx on public.contact_processing_logs(processing_date);
create index contact_processing_logs_contact_id_idx on public.contact_processing_logs(contact_id);
create index contact_processing_logs_batch_id_idx on public.contact_processing_logs(batch_id);
create index contact_processing_logs_retry_count_idx on public.contact_processing_logs(retry_count);
create index contact_processing_logs_status_idx on public.contact_processing_logs(status);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index notification_history_user_time_idx on public.notification_history(user_id, sent_at);
create index contact_analytics_user_id_idx on public.contact_analytics(user_id);
create index contact_analytics_generated_at_idx on public.contact_analytics(generated_at);
create index content_reports_user_id_idx on public.content_reports(user_id);
create index content_reports_contact_id_idx on public.content_reports(contact_id);

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
alter table public.content_reports enable row level security;

-- Create policies
create policy "Users can view their own contacts"
    on public.contacts for select
    using (auth.uid() = user_id);

create policy "Users can insert their own contacts"
    on public.contacts for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own contacts"
    on public.contacts for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own contacts"
    on public.contacts for delete
    using (auth.uid() = user_id);

create policy "Users can view their own interactions"
    on public.interactions for select
    using (auth.uid() = user_id);

create policy "Users can insert their own interactions"
    on public.interactions for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own interactions"
    on public.interactions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own interactions"
    on public.interactions for delete
    using (auth.uid() = user_id);

create policy "Users can view their own reminders"
    on public.reminders for select
    using (auth.uid() = user_id);

create policy "Users can insert their own reminders"
    on public.reminders for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own reminders"
    on public.reminders for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own reminders"
    on public.reminders for delete
    using (auth.uid() = user_id);

create policy "Users can view their own preferences"
    on public.user_preferences for select
    using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
    on public.user_preferences for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
    on public.user_preferences for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can view their own subscription"
    on public.subscriptions for select
    using (auth.uid() = user_id);

create policy "Users can insert their own subscription"
    on public.subscriptions for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own subscription"
    on public.subscriptions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can view their own push subscriptions"
    on public.push_subscriptions for select
    using (auth.uid() = user_id);

create policy "Users can insert their own push subscriptions"
    on public.push_subscriptions for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own push subscriptions"
    on public.push_subscriptions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
    on public.push_subscriptions for delete
    using (auth.uid() = user_id);

create policy "Users can view their own notification history"
    on public.notification_history for select
    using (auth.uid() = user_id);

create policy "Users can view their own analytics"
    on public.contact_analytics for select
    using (auth.uid() = user_id);

create policy "Users can insert their own analytics"
    on public.contact_analytics for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own analytics"
    on public.contact_analytics for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own analytics"
    on public.contact_analytics for delete
    using (auth.uid() = user_id);

-- Content reports policies
create policy "Users can view their own content reports"
    on public.content_reports for select
    using (auth.uid() = user_id);

create policy "Users can insert content reports"
    on public.content_reports for insert
    with check (auth.uid() = user_id);

-- Allow service role to read necessary tables for push notifications
create policy "Service role can read user preferences"
    on public.user_preferences for select
    using (true);

create policy "Service role can read push subscriptions"
    on public.push_subscriptions for select
    using (true);

create policy "Service role can insert notification history"
    on public.notification_history for insert
    with check (true);

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