-- Add email column to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email text;

-- Update preferred_contact_method enum to include 'email'
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_preferred_contact_method_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_preferred_contact_method_check
CHECK (preferred_contact_method in ('call', 'message', 'social', 'email', null));

-- Update interaction type enum to include 'email'
ALTER TABLE public.interactions DROP CONSTRAINT IF EXISTS interactions_type_check;
ALTER TABLE public.interactions ADD CONSTRAINT interactions_type_check
CHECK (type in ('call', 'message', 'social', 'meeting', 'email'));

-- Update reminder type enum to include 'email'
ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_type_check;
ALTER TABLE public.reminders ADD CONSTRAINT reminders_type_check
CHECK (type in ('call', 'message', 'social', 'email'));