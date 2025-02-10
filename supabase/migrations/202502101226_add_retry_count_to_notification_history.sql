-- Add retry_count column to notification_history table
ALTER TABLE notification_history
ADD COLUMN retry_count INTEGER DEFAULT 0;