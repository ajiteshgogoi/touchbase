#!/bin/bash

# List of Edge Functions to deploy
functions=(
  "activate-subscription"
  "bulk-import"
  "cancel-google-subscription"
  "cancel-subscription"
  "check-duplicate-contact"
  "create-subscription"
  "delete-user"
  "get-user-stats"
  "google-play-webhooks"
  "paypal-webhooks"
  "push-notifications"
  "sync-to-brevo"
  "users"
  "verify-google-purchase"
)

echo "Deploying Edge Functions..."

# Deploy each function
for func in "${functions[@]}"; do
  echo "Deploying $func..."
  supabase functions deploy "$func" --project-ref "$SUPABASE_PROJECT_ID"
done

echo "Edge Functions deployment complete!"