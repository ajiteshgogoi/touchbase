-- First add columns without constraints
alter table public.push_subscriptions
add column expires_at timestamp with time zone,
add column last_refresh timestamp with time zone,
add column refresh_count integer;

-- Initialize data for existing records
update public.push_subscriptions
set expires_at = created_at + interval '30 days',
    last_refresh = updated_at,
    refresh_count = 0;

-- Now make columns not null with defaults
alter table public.push_subscriptions
alter column expires_at set not null,
alter column expires_at set default (now() + interval '30 days'),
alter column last_refresh set not null,
alter column last_refresh set default now(),
alter column refresh_count set not null,
alter column refresh_count set default 0;

-- Add constraint only after data is valid
alter table public.push_subscriptions
add constraint check_refresh_rate
check (
    refresh_count <= 1000 -- Max 1000 refreshes
    and (
        -- Skip check for new records (last_refresh will equal now())
        last_refresh = now()
        or
        -- Otherwise ensure minimum time between refreshes
        extract(epoch from (now() - last_refresh)) >= 3600
    )
);

-- Add device limit function
create or replace function check_device_limit()
returns trigger as $$
begin
    if (select count(*) from public.push_subscriptions where user_id = NEW.user_id) >= 10 then
        raise exception 'Maximum number of devices (10) reached for user';
    end if;
    return NEW;
end;
$$ language plpgsql;

-- Add device limit trigger
drop trigger if exists enforce_device_limit on public.push_subscriptions;
create trigger enforce_device_limit
before insert on public.push_subscriptions
for each row execute function check_device_limit();

-- Add cleanup function for expired tokens
create or replace function cleanup_expired_tokens()
returns trigger as $$
begin
    delete from public.push_subscriptions
    where expires_at < now();
    return null;
end;
$$ language plpgsql;

-- Add cleanup trigger that runs on any push_subscriptions modification
drop trigger if exists cleanup_expired_tokens_trigger on public.push_subscriptions;
create trigger cleanup_expired_tokens_trigger
after insert or update on public.push_subscriptions
for each statement execute function cleanup_expired_tokens();