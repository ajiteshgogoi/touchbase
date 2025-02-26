-- Drop existing constraint
alter table if exists public.push_subscriptions
drop constraint if exists check_refresh_rate;

-- Add new simplified constraint
alter table public.push_subscriptions
add constraint check_refresh_rate
check (
    refresh_count <= 1000 -- Max 1000 refreshes per token
    and last_refresh <= now() -- Ensure last_refresh is not in future
);

-- Log migration in change history
comment on constraint check_refresh_rate on public.push_subscriptions is 'Removed time-based rate limiting, keeping only refresh count limit';