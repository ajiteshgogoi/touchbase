-- Create notification tracking table
create table public.notification_history (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users not null,
    notification_type text not null check (notification_type in ('morning', 'afternoon', 'evening')),
    sent_at timestamp with time zone not null,
    created_at timestamp with time zone default now()
);

-- Add index for faster lookups
create index notification_history_user_time_idx on public.notification_history(user_id, sent_at);

-- Enable RLS
alter table public.notification_history enable row level security;

-- Add policies
create policy "Users can view their own notification history"
    on public.notification_history for select
    using (auth.uid() = user_id);

create policy "Service role can insert notification history"
    on public.notification_history for insert
    with check (true);