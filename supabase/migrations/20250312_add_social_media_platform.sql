-- Add social_media_platform column to contacts table
ALTER TABLE public.contacts
ADD COLUMN social_media_platform text;

-- Add check constraint for valid platforms
ALTER TABLE public.contacts
ADD CONSTRAINT social_media_platform_check 
CHECK (social_media_platform in ('linkedin', 'instagram', 'twitter', null));

-- Note: Existing rows will have social_media_platform as null by default

-- Update function to format social media URLs when fetching contacts
CREATE OR REPLACE FUNCTION format_social_media_url(handle text, platform text)
RETURNS text AS $$
BEGIN
    IF handle IS NULL OR platform IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN CASE platform
        WHEN 'twitter' THEN 'https://twitter.com/' || handle
        WHEN 'instagram' THEN 'https://instagram.com/' || handle
        WHEN 'linkedin' THEN 'https://linkedin.com/in/' || handle
        ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN public.contacts.social_media_platform IS 'The social media platform (linkedin, instagram, twitter)';