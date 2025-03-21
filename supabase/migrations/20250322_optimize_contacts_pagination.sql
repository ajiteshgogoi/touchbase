-- Create a new covering index for optimized pagination
CREATE INDEX IF NOT EXISTS contacts_pagination_covering_idx ON public.contacts 
(user_id, created_at DESC)
INCLUDE (id, name, phone, social_media_platform, social_media_handle, 
last_contacted, next_contact_due, preferred_contact_method, notes, 
contact_frequency, missed_interactions);

-- Optimize the contacts pagination query
CREATE OR REPLACE FUNCTION get_paginated_contacts(
  p_user_id UUID,
  p_limit INTEGER,
  p_offset INTEGER
) RETURNS TABLE (
  total_result_set INTEGER,
  page_total INTEGER,
  body JSONB,
  response_headers TEXT,
  response_status TEXT,
  response_inserted BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH base_query AS (
    SELECT *
    FROM public.contacts 
    WHERE user_id = p_user_id
  ),
  page_query AS (
    SELECT *
    FROM base_query
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  total_count AS (
    SELECT count(*)::integer AS total
    FROM base_query
  )
  SELECT 
    (SELECT total FROM total_count) as total_result_set,
    count(*)::integer as page_total,
    COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as body,
    NULL as response_headers,
    NULL as response_status,
    FALSE as response_inserted
  FROM page_query t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_paginated_contacts(UUID, INTEGER, INTEGER) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_paginated_contacts IS 'Optimized pagination function for contacts using covering index';