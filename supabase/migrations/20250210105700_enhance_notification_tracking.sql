-- Add notification status enum
create type notification_status as enum ('success', 'error', 'invalid_token');

-- Add new columns to notification_history
alter table notification_history
  add column if not exists status notification_status not null default 'success',
  add column if not exists error_message text,
  add column if not exists batch_id uuid;

-- Add indexes for better query performance
create index if not exists idx_notification_batch on notification_history(batch_id);
create index if not exists idx_notification_status on notification_history(status);
create index if not exists idx_notification_sent_at on notification_history(sent_at);

-- Add comment descriptions
comment on column notification_history.status is 'Status of the notification attempt';
comment on column notification_history.error_message is 'Error message if notification failed';
comment on column notification_history.batch_id is 'UUID to group notifications processed in the same batch';

-- Add row level security policies
alter table notification_history enable row level security;

create policy "Allow read access to own notifications"
  on notification_history
  for select
  using (auth.uid() = user_id);

create policy "Allow insert for service role only"
  on notification_history
  for insert
  with check (auth.jwt()->>'role' = 'service_role');

-- Backfill existing records
update notification_history
set status = 'success'
where status is null;