-- Add trial period tracking to subscriptions table
alter table public.subscriptions 
add column trial_start_date timestamp with time zone,
add column trial_end_date timestamp with time zone;

-- Update existing free users to not have trial period
update public.subscriptions
set trial_start_date = null, trial_end_date = null
where plan_id = 'free';