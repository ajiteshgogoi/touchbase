-- Drop the unused billing_period column from subscriptions table
alter table if exists public.subscriptions
    drop column if exists billing_period;
