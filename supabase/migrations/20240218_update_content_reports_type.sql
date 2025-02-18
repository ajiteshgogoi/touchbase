-- Drop existing content_type constraint
ALTER TABLE public.content_reports
DROP CONSTRAINT IF EXISTS content_reports_content_type_check;

-- Add new content_type constraint
ALTER TABLE public.content_reports
ADD CONSTRAINT content_reports_content_type_check 
CHECK (content_type in ('suggestion', 'conversation-prompt'));