-- Add rating-related columns to user_preferences table
alter table public.user_preferences
add column has_rated_app boolean default false,
add column last_rating_prompt timestamp with time zone,
add column install_time timestamp with time zone default now();

-- Add comments for rating columns
comment on column public.user_preferences.has_rated_app is 'Whether the user has rated the app';
comment on column public.user_preferences.last_rating_prompt is 'When the user was last prompted to rate the app';
comment on column public.user_preferences.install_time is 'When the user first installed the app';

-- Add index for install_time to optimize rating prompt queries
create index idx_user_preferences_install_time on public.user_preferences(install_time);