-- Add name column to reminders table for quick reminders
ALTER TABLE public.reminders
ADD COLUMN name text;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN public.reminders.name IS 'Optional name field used for quick reminders. When present, indicates this is a quick reminder rather than a regular contact reminder.';

-- Update schema.sql by adding the new column
-- Run: supabase db dump -f supabase/schema.sql