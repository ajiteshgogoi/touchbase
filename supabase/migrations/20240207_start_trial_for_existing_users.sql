-- Start trial for existing free users who don't have a trial period set
UPDATE public.subscriptions
SET 
  trial_start_date = NOW(),
  trial_end_date = NOW() + INTERVAL '14 days'
WHERE 
  plan_id = 'free' 
  AND trial_start_date IS NULL 
  AND trial_end_date IS NULL;