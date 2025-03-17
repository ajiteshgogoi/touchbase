-- Migration: Add optimized upcoming events function and index
-- Description: Adds a PostgreSQL function for efficient event retrieval with yearly recurrence

-- Add function for optimized event retrieval with yearly recurrence
create or replace function get_upcoming_events(
  p_user_id uuid,
  p_visible_contact_ids uuid[] default null,
  p_months_ahead int default 12,
  p_limit int default null
)
returns table (
  id uuid,
  contact_id uuid,
  user_id uuid,
  type text,
  name text,
  date timestamp with time zone,
  next_occurrence timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) as $$
begin
  return query
  with recurring_dates as (
    select 
      e.*,
      case 
        when (date_trunc('day', e.date) + interval '1 year' * 
          ceil(extract(years from age(current_timestamp, e.date)))) < current_timestamp
        then date_trunc('day', e.date) + interval '1 year' * 
          (ceil(extract(years from age(current_timestamp, e.date))) + 1)
        else date_trunc('day', e.date) + interval '1 year' * 
          ceil(extract(years from age(current_timestamp, e.date)))
      end as next_occurrence
    from important_events e
    where e.user_id = p_user_id
      and (p_visible_contact_ids is null or e.contact_id = any(p_visible_contact_ids))
  )
  select 
    rd.id,
    rd.contact_id,
    rd.user_id,
    rd.type,
    rd.name,
    rd.date,
    rd.next_occurrence,
    rd.created_at,
    rd.updated_at
  from recurring_dates rd
  where rd.next_occurrence <= current_timestamp + (p_months_ahead || ' months')::interval
  order by rd.next_occurrence
  limit p_limit;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function get_upcoming_events(uuid, uuid[], int, int) to authenticated;

-- Create an IMMUTABLE function for next occurrence calculation
create or replace function calculate_next_occurrence(event_date timestamp with time zone)
returns timestamp with time zone
language sql
immutable
as $$
  select date_trunc('day', event_date) +
    make_interval(years :=
      case
        when extract(year from age(date_trunc('day', '2000-01-01'::timestamp), date_trunc('day', event_date))) < 0 then 0
        when date_trunc('day', event_date + make_interval(years := extract(year from age(date_trunc('day', '2000-01-01'::timestamp), date_trunc('day', event_date)))::int)) < date_trunc('day', '2000-01-01'::timestamp)
        then extract(year from age(date_trunc('day', '2000-01-01'::timestamp), date_trunc('day', event_date)))::int + 1
        else extract(year from age(date_trunc('day', '2000-01-01'::timestamp), date_trunc('day', event_date)))::int
      end
    );
$$;

-- Add index using the immutable function
create index if not exists important_events_next_occurrence_idx
  on important_events (calculate_next_occurrence(date));

-- Update the get_upcoming_events function to use the immutable function
create or replace function get_upcoming_events(
  p_user_id uuid,
  p_visible_contact_ids uuid[] default null,
  p_months_ahead int default 12,
  p_limit int default null
)
returns table (
  id uuid,
  contact_id uuid,
  user_id uuid,
  type text,
  name text,
  date timestamp with time zone,
  next_occurrence timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) as $$
begin
  return query
  select
    e.id,
    e.contact_id,
    e.user_id,
    e.type,
    e.name,
    e.date,
    calculate_next_occurrence(e.date) +
      make_interval(years :=
        case
          when calculate_next_occurrence(e.date) < current_timestamp
          then cast(extract(year from age(current_timestamp, calculate_next_occurrence(e.date))) as int)
          else 0
        end
      ) as next_occurrence,
    e.created_at,
    e.updated_at
  from important_events e
  where e.user_id = p_user_id
    and (p_visible_contact_ids is null or e.contact_id = any(p_visible_contact_ids))
    and calculate_next_occurrence(e.date) <= current_timestamp + (p_months_ahead || ' months')::interval
  order by next_occurrence
  limit p_limit;
end;
$$ language plpgsql security definer;

-- Add down migration
-- Revert function if needed:
-- drop function if exists calculate_next_occurrence(timestamp with time zone);
-- drop function if exists get_upcoming_events(uuid, uuid[], int, int);
-- drop index if exists important_events_next_occurrence_idx;