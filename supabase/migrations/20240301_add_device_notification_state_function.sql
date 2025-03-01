create or replace function get_device_notification_state(
  p_user_id uuid,
  p_device_id text
) returns table (
  enabled boolean
) language plpgsql security definer as $$
begin
  return query
  select ps.enabled
  from push_subscriptions ps
  where ps.user_id = p_user_id
  and ps.device_id = p_device_id
  limit 1;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function get_device_notification_state(uuid, text) to authenticated;