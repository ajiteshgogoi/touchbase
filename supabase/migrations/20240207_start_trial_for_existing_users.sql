-- Create subscription records for existing users who don't have one
INSERT INTO public.subscriptions (user_id, plan_id, status, valid_until, trial_start_date, trial_end_date)
SELECT
  id as user_id,
  'free' as plan_id,
  'active' as status,
  '2200-01-01'::timestamp with time zone as valid_until,
  NULL as trial_start_date,
  NULL as trial_end_date
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s
  WHERE s.user_id = u.id
);