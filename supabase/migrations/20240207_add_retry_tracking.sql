-- Add retry_count column and update status check
alter table public.contact_processing_logs
    add column if not exists retry_count integer default 0,
    add column if not exists last_error text,
    drop constraint if exists contact_processing_logs_status_check,
    add constraint contact_processing_logs_status_check 
        check (status in ('pending', 'success', 'error', 'max_retries_exceeded'));

-- Add index for retry_count to help with querying failed attempts
create index if not exists contact_processing_logs_retry_count_idx 
    on public.contact_processing_logs(retry_count);

-- Create index on status to help with filtering by processing status
create index if not exists contact_processing_logs_status_idx 
    on public.contact_processing_logs(status);