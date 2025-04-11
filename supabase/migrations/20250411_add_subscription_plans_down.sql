-- Remove foreign key from subscriptions table
alter table if exists public.subscriptions
    drop column if exists subscription_plan_id,
    drop column if exists billing_period;

-- Drop index
drop index if exists subscription_plans_google_play_idx;

-- Drop policy
drop policy if exists "Anyone can read subscription plans" on public.subscription_plans;

-- Drop table
drop table if exists public.subscription_plans;