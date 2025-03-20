-- Add type and reason columns to feedback table
alter table public.feedback
add column type text check (type in ('general', 'cancellation')) default 'general',
add column reason text;

-- Add index for type column
create index if not exists feedback_type_idx on public.feedback(type);

-- Add helpful comments
comment on column public.feedback.type is 'Type of feedback (general or cancellation)';
comment on column public.feedback.reason is 'Specific reason category for cancellation feedback';