-- Add batch tracking fields to contact_processing_logs
alter table public.contact_processing_logs
    add column batch_id text,
    add column status text check (status in ('pending', 'success', 'error')),
    add column error_message text;

-- Add index for batch_id to help with batch queries
create index contact_processing_logs_batch_id_idx on public.contact_processing_logs(batch_id);

-- Update existing rows to have success status
update public.contact_processing_logs
set status = 'success'
where status is null;