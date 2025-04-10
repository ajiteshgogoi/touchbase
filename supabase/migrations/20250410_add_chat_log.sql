-- Create chat_log table for rate limiting
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