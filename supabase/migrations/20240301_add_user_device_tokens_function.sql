create or replace function get_user_device_tokens(
  p_user_id uuid,
  p_namespace text
) returns table (
  device_id text,
  device_type text,
  enabled boolean
) language plpgsql security definer as $$
begin
  return query
  select 
    ps.device_id,
    ps.device_type,
    ps.enabled
  from push_subscriptions ps
  where ps.user_id = p_user_id
  and ps.device_id ilike p_namespace || '%';
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function get_user_device_tokens(uuid, text) to authenticated;