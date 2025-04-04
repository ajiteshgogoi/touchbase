-- Migration: Add interaction and contact update functions
-- Description: Add functions to handle interaction logging and contact updates in a single transaction

-- Helper function to calculate next contact due date
CREATE OR REPLACE FUNCTION calculate_next_contact_due(
  p_frequency TEXT,
  p_missed_interactions INTEGER,
  p_last_contacted TIMESTAMP WITH TIME ZONE
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  RETURN p_last_contacted + 
    CASE p_frequency
      WHEN 'every_three_days' THEN INTERVAL '3 days'
      WHEN 'weekly' THEN INTERVAL '1 week'
      WHEN 'fortnightly' THEN INTERVAL '2 weeks'
      WHEN 'monthly' THEN INTERVAL '1 month'
      WHEN 'quarterly' THEN INTERVAL '3 months'
    END +
    -- Add extra days based on missed interactions
    (p_missed_interactions * INTERVAL '1 day');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function to log interaction and update contact
CREATE OR REPLACE FUNCTION log_interaction_and_update_contact(
  p_contact_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_date TIMESTAMP WITH TIME ZONE,
  p_notes TEXT,
  p_sentiment TEXT
) RETURNS TABLE (
  interaction_id UUID,
  contact_updated BOOLEAN
) AS $$
DECLARE
  v_latest_interaction TIMESTAMP WITH TIME ZONE;
  v_contact RECORD;
  v_interaction_id UUID;
BEGIN
  -- Get contact details first
  SELECT * INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
  FOR UPDATE;  -- Lock the row to prevent concurrent updates

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- Insert the interaction
  INSERT INTO interactions (
    contact_id,
    user_id,
    type,
    date,
    notes,
    sentiment
  )
  VALUES (
    p_contact_id,
    p_user_id,
    p_type,
    p_date,
    p_notes,
    p_sentiment
  )
  RETURNING id INTO v_interaction_id;

  -- Get the latest interaction date for this contact
  SELECT date INTO v_latest_interaction
  FROM interactions
  WHERE contact_id = p_contact_id
  ORDER BY date DESC
  LIMIT 1;

  -- Only update contact if this is the latest interaction
  IF v_latest_interaction <= p_date THEN
    UPDATE contacts
    SET 
      last_contacted = p_date,
      missed_interactions = 0,
      next_contact_due = calculate_next_contact_due(
        contact_frequency,
        0,  -- Reset missed_interactions
        p_date
      )
    WHERE id = p_contact_id;
    
    RETURN QUERY
    SELECT v_interaction_id, true;
  ELSE
    RETURN QUERY
    SELECT v_interaction_id, false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION calculate_next_contact_due(TEXT, INTEGER, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION log_interaction_and_update_contact(UUID, UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT) TO authenticated;