-- Step 1: Add new columns without constraints
alter table public.push_subscriptions 
add column expires_at timestamp with time zone,
add column last_refresh timestamp with time zone,
add column refresh_count integer;

-- Step 2: Initialize data with safe values
update public.push_subscriptions ps
set expires_at = ps.created_at + interval '30 days',
    -- Set initial refresh time safely in the past
    last_refresh = least(ps.updated_at, now() - interval '2 hours'),
    refresh_count = 0;

-- Step 3: Make columns not null with defaults
alter table public.push_subscriptions 
alter column expires_at set not null,
alter column expires_at set default (now() + interval '30 days'),
alter column last_refresh set not null,
alter column last_refresh set default now(),
alter column refresh_count set not null,
alter column refresh_count set default 0;

-- Step 4: Cleanup any potential violations before adding constraint
delete from public.push_subscriptions
where refresh_count > 1000
   or expires_at < now();

-- Step 5: Add the rate limiting constraint separately
do $$
begin
  -- First remove if exists (to allow rerunning migration)
  alter table public.push_subscriptions 
  drop constraint if exists check_refresh_rate;

  -- Then add the new constraint
  alter table public.push_subscriptions 
  add constraint check_refresh_rate 
  check (
      refresh_count <= 1000 -- Max 1000 refreshes
      and (
          last_refresh <= now() -- Ensure last_refresh is not in future
          and (
              last_refresh = now() -- Skip time check for new records
              or 
              extract(epoch from (now() - last_refresh)) >= 3600 -- 1 hour minimum between refreshes
          )
      )
  );
exception when others then
  -- If constraint fails, set all refresh times to safe values
  update public.push_subscriptions
  set last_refresh = now() - interval '2 hours',
      refresh_count = 0
  where true;
  
  -- Try adding constraint again
  alter table public.push_subscriptions 
  add constraint check_refresh_rate 
  check (
      refresh_count <= 1000
      and (
          last_refresh <= now()
          and (
              last_refresh = now()
              or 
              extract(epoch from (now() - last_refresh)) >= 3600
          )
      )
  );
end$$;

-- Step 6: Add device limit function
create or replace function check_device_limit()
returns trigger as $$
begin
    if (select count(*) from public.push_subscriptions where user_id = NEW.user_id) >= 10 then
        raise exception 'Maximum number of devices (10) reached for user';
    end if;
    return NEW;
end;
$$ language plpgsql;

-- Step 7: Add device limit trigger
drop trigger if exists enforce_device_limit on public.push_subscriptions;
create trigger enforce_device_limit
before insert on public.push_subscriptions
for each row execute function check_device_limit();

-- Step 8: Add cleanup function for expired tokens
create or replace function cleanup_expired_tokens()
returns trigger as $$
begin
    delete from public.push_subscriptions
    where expires_at < now();
    return null;
end;
$$ language plpgsql;

-- Step 9: Add cleanup trigger
drop trigger if exists cleanup_expired_tokens_trigger on public.push_subscriptions;
create trigger cleanup_expired_tokens_trigger
after insert or update on public.push_subscriptions
for each statement execute function cleanup_expired_tokens();