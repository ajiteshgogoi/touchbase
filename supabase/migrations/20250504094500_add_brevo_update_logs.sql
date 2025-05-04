-- Migration to add brevo_update_logs table

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