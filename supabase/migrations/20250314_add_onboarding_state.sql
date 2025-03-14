-- Add onboarding completed field to user preferences
alter table public.user_preferences
add column onboarding_completed boolean default false;

-- Add comment for the new column
comment on column public.user_preferences.onboarding_completed is 'Whether the user has completed the onboarding flow';

-- Add index for efficient querying
create index idx_user_preferences_onboarding on public.user_preferences(onboarding_completed);

-- Mark onboarding as completed for existing users who have contacts
update public.user_preferences up
set onboarding_completed = true
from public.contacts c
where c.user_id = up.user_id
  and exists (
    select 1
    from public.contacts
    where user_id = up.user_id
    limit 1
  );