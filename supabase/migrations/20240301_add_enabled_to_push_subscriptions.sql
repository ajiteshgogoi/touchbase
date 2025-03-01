-- Add enabled field to push_subscriptions
ALTER TABLE public.push_subscriptions 
ADD COLUMN enabled boolean NOT NULL DEFAULT false;

-- Update existing subscriptions to be enabled if they have valid tokens
UPDATE public.push_subscriptions 
SET enabled = true 
WHERE fcm_token IS NOT NULL;